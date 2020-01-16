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
            return result[referred]
        else:
            return result

    def _get_state_for_referral(self):
        self.ensure_one()
        r = 'in_progress'
        if self.state == 'draft' or self.state == 'sent':
            r = 'new'
        elif not self.has_to_be_paid():
            r = 'done'
        elif self.state == 'lost':
            r = 'cancel'

    def write(self, vals):
        if(any(elem in vals for elem in ['state', 'is_expired', 'require_payment', 'amount_total', 'transaction_ids', 'transaction_ids.state'])):
            referrer = self.env['res.partner'].search([('utm_source_id', '=', self.source_id.id)])
            if not referrer.referrer_rewarded_id:
                old_state = self.get_referral_statuses(referrer, self.partner_id)
                r = super().write(vals)
                new_state = self.get_referral_statuses(referrer, self.partner_id)
                if(STATES_PRIORITY[new_state] > STATES_PRIORITY[old_state]):
                    template = self.env.ref('website_sale_referral.referral_state_changed_email_template', False)
                    template.sudo().with_context({'referred': self.partner_id, 'state': _(new_state)}).send_mail(referrer.id, force_send=True)
                    if(new_state == 'done'):
                        self.activity_schedule(
                            act_type_xmlid='mail.mail_activity_data_todo',
                            summary='The referrer for this lead deserves a reward',
                            user_id=self.env['res.config.settings'].responsible_id)
                return r
        return super().write(vals)
