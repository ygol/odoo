from odoo import models, fields, api, _

STATES_PRIORITY = {'cancel': 0, 'new': 1, 'in_progress': 2, 'done': 3}


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    is_fully_paid = fields.Boolean(compute='_compute_is_fully_paid', store=True)

    @api.depends('state', 'is_expired', 'require_payment', 'amount_total', 'transaction_ids', 'transaction_ids.state')
    def _compute_is_fully_paid(self):
        for so in self:
            is_fully_paid = not so.has_to_be_paid()

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
        if self.state == 'draft' or self.state == 'sent':
            r = 'new'
        elif not self.has_to_be_paid():
            r = 'done'
        elif self.state == 'cancel':
            r = 'cancel'

    def write(self, vals):
        if not self.env.user.has_group('website_crm_referral.group_lead_referral') and \
           not self.partner_id.referrer_rewarded_id and \
           any(elem in vals for elem in ['state', 'is_expired', 'require_payment', 'amount_total', 'transaction_ids', 'transaction_ids.state']):
            referrer = self.env['res.partner'].search([('utm_source_id', '=', self.source_id.id)])
            old_state = self.get_referral_statuses(referrer, self.partner_id)
            r = super().write(vals)
            new_state = self.get_referral_statuses(referrer, self.partner_id)

            if new_state != old_state:
                if new_state == 'done':
                    template = self.env.ref('website_sale_referral.referral_won_email_template', False)
                    template.sudo().with_context({'referred': self.partner_id}).send_mail(referrer.id, force_send=True)

                    responsible_id = self.env['ir.config_parameter'].sudo().get_param('website_sale_referral.responsible_id') or self.user_id.id
                    if responsible_id:
                        self.activity_schedule(
                            act_type_xmlid='mail.mail_activity_data_todo',
                            summary='The referrer for this lead deserves a reward',
                            user_id=responsible_id)
                        self.partner_id.referrer_rewarded_id = referrer.id

                elif new_state == 'cancel':
                    template = self.env.ref('website_sale_referral.referral_cancelled_email_template', False)
                    template.sudo().with_context({'referred': self.partner_id}).send_mail(referrer.id, force_send=True)

                else:
                    template = self.env.ref('website_sale_referral.referral_state_changed_email_template', False)
                    template.sudo().with_context({'referred': self.partner_id, 'state': _(new_state)}).send_mail(referrer.id, force_send=True)

            return r
        else:
            return super().write(vals)
