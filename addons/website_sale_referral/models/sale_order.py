from odoo import models, fields, api, _, SUPERUSER_ID

STATES_PRIORITY = {'cancel': 0, 'new': 1, 'in_progress': 2, 'done': 3}


class MailActivity(models.Model):
    _inherit = 'mail.activity'

    sale_id = fields.Many2one('crm.lead')

    def _action_done(self, feedback=False, attachment_ids=None):
        self.sale_id.partner_id.reward_done = True
        return super(MailActivity, self)._action_done(feedback=feedback, attachment_ids=attachment_ids)


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    is_fully_paid = fields.Boolean(compute='_compute_is_fully_paid', store=True)

    @api.depends('state', 'invoice_status', 'amount_total', 'invoice_ids', 'invoice_ids.state', 'invoice_ids.payment_state', 'invoice_ids.amount_total')
    def _compute_is_fully_paid(self):
        for so in self:
            if so.invoice_status != 'invoiced':
                r = False
            else:
                amount_paid = 0
                for inv in so.invoice_ids:
                    if inv.state == 'posted' and inv.payment_state == 'paid':
                        amount_paid += inv.currency_id._convert(inv.amount_total, so.currency_id, so.company_id, so.date_order)
                r = 0 == so.currency_id.compare_amounts(so.amount_total, amount_paid)
            so.is_fully_paid = r

    def get_referral_statuses(self, referrer, referred=None):
        criteria = [
            ('campaign_id', '=', self.env.ref('website_sale_referral.utm_campaign_referral').id),
            ('source_id', '=', referrer.sudo().utm_source_id.id)]
        if referred:
            criteria.append(('partner_id', '=', referred.id))
        sales_orders = self.search(criteria)

        result = {}
        for so in sales_orders:
            state = so._get_state_for_referral()
            if(so.partner_id not in result or STATES_PRIORITY[state] > STATES_PRIORITY[result[so.partner_id]]):
                result[so.partner_id] = state

        if referred:
            return result.get(referred, None)
        else:
            return result

    def _get_state_for_referral(self):
        self.ensure_one()
        r = 'in_progress'
        if self.state == 'draft':
            r = 'new'
        elif self.is_fully_paid:
            r = 'done'
        elif self.state == 'cancel':
            r = 'cancel'
        return r

    def write(self, vals):
        if not self.env.user.has_group('website_crm_referral.group_lead_referral') and \
           not self.partner_id.referrer_to_reward_id and \
           any(elem in vals for elem in ['state', 'invoice_status', 'amount_total', 'invoice_ids']):
            referrer = self.env['res.partner'].search([('utm_source_id', '=', self.source_id.id)])
            old_state = self.get_referral_statuses(referrer, self.partner_id)
            r = super().write(vals)
            new_state = self.get_referral_statuses(referrer, self.partner_id)

            if new_state != old_state:
                referrer.referral_updates += 1
                if new_state == 'done':
                    template = self.env.ref('website_sale_referral.referral_won_email_template', False)
                    template.sudo().with_context({'referred': self.partner_id}).send_mail(referrer.id, force_send=True)

                    responsible_id = self.env['ir.config_parameter'].sudo().get_param('website_sale_referral.responsible_id') or SUPERUSER_ID
                    if responsible_id:
                        activity = self.activity_schedule(
                            act_type_xmlid='website_sale_referral.mail_act_data_referral_reward',
                            summary='The referrer for this lead deserves a reward',
                            user_id=responsible_id)
                        activity.update({'sale_id': self.id})
                        self.partner_id.referrer_to_reward_id = referrer.id

                elif new_state == 'cancel':
                    template = self.env.ref('website_sale_referral.referral_cancelled_email_template', False)
                    template.sudo().with_context({'referred': self.partner_id}).send_mail(referrer.id, force_send=True)

                else:
                    template = self.env.ref('website_sale_referral.referral_state_changed_email_template', False)
                    template.sudo().with_context({'referred': self.partner_id, 'state': _(new_state)}).send_mail(referrer.id, force_send=True)

            return r
        else:
            return super().write(vals)
