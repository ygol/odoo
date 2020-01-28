from odoo import models, fields, api, _, SUPERUSER_ID


class SaleOrder(models.Model):
    _name = 'sale.order'
    _inherit = ['sale.order', 'referral.mixin']

    referral_email = fields.Char(related='partner_id.email', description="The email used to identify the refered")

    def is_fully_paid(self):
        self.ensure_one()
        if self.invoice_status != 'invoiced':
            return False
        else:
            amount_paid = 0
            for inv in self.invoice_ids:
                if inv.state == 'posted' and inv.payment_state == 'paid':
                    amount_paid += inv.currency_id._convert(inv.amount_total, self.currency_id, self.company_id, self.date_order)
            return 0 == self.currency_id.compare_amounts(self.amount_total, amount_paid)

    def get_referral_statuses(self, utm_source_id, referred_email=None):
        sales_orders = self.find(utm_source_id, referred_email)

        result = {}
        for so in sales_orders:
            state = so._get_state_for_referral()
            if(so.partner_id.email not in result or self.STATES_PRIORITY[state] > self.STATES_PRIORITY[result[so.partner_id.email]]):
                result[so.partner_id.email] = state

        if referred_email:
            return result.get(referred_email, None)
        else:
            return result

    def _get_state_for_referral(self):
        self.ensure_one()
        r = 'in_progress'
        if self.state == 'draft':
            r = 'new'
        elif self.is_fully_paid():
            r = 'done'
        elif self.state == 'cancel':
            r = 'cancel'
        return r

    def write(self, vals):
        if not self.env.user.has_group('website_crm_referral.group_lead_referral') and \
           not self.to_reward and \
           any([elem in vals for elem in ['state', 'invoice_status', 'amount_total', 'invoice_ids']]):
            old_state = self.get_referral_statuses(self.source_id, self.partner_id.email)
            r = super().write(vals)
            new_state = self.get_referral_statuses(self.source_id, self.partner_id.email)

            self.check_referral_progress(old_state, new_state)

            return r
        else:
            return super().write(vals)
