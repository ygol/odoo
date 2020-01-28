from odoo import models, fields, api


class AccountMove(models.Model):
    _inherit = 'account.move'

    def write(self, vals):
        if not self.env.user.has_group('website_crm_referral.group_lead_referral') and \
           any([elem in vals for elem in ['state', 'payment_state', 'amount_total']]):
            ids = [rec.id for rec in self]
            sos = self.env['sale.order'].search([('invoice_ids', 'in', ids)])

            old_statuses = {}
            for so in sos:
                old_statuses[so] = so.get_referral_statuses(so.source_id, so.partner_id.email)
            r = super().write(vals)
            for so in sos:
                new_state = so.get_referral_statuses(so.source_id, so.partner_id.email)
                so.check_referral_progress(old_statuses[so], new_state)
            return r
        else:
            return super().write(vals)


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    def write(self, vals):
        if not self.env.user.has_group('website_crm_referral.group_lead_referral') and \
           any([elem in vals for elem in ['debit', 'credit', 'currency_id', 'amount_currency', 'amount_residual', 'amount_residual_currency', 'full_reconcile_id']]):
            ids = [rec.move_id.id for rec in self]
            sos = self.env['sale.order'].search([('invoice_ids', 'in', ids)])

            old_statuses = {}
            for so in sos:
                old_statuses[so] = so.get_referral_statuses(so.source_id, so.partner_id.email)
            r = super().write(vals)
            for so in sos:
                new_state = so.get_referral_statuses(so.source_id, so.partner_id.email)
                so.check_referral_progress(old_statuses[so], new_state)
            return r
        else:
            return super().write(vals)


class AccountPayment(models.Model):
    _inherit = 'account.payment'

    def write(self, vals):
        if not self.env.user.has_group('website_crm_referral.group_lead_referral') and \
           any([elem in vals for elem in ['state']]):
            ids = []
            for rec in self:
                ids.extend(rec.invoice_ids.ids)
            sos = self.env['sale.order'].search([('invoice_ids', 'in', ids)])

            old_statuses = {}
            for so in sos:
                old_statuses[so] = so.get_referral_statuses(so.source_id, so.partner_id.email)
            r = super().write(vals)
            for so in sos:
                new_state = so.get_referral_statuses(so.source_id, so.partner_id.email)
                so.check_referral_progress(old_statuses[so], new_state)
            return r
        else:
            return super().write(vals)
