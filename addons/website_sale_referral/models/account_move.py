from odoo import models, fields, api


class AccountMove(models.Model):
    _inherit = 'account.move'

    def action_invoice_paid(self):
        # OVERRIDE
        sos = self.env['sale.order'].search([('invoice_ids', '=', self.id)])
        for so in sos:
            if(not so.to_reward and so.is_fully_paid()):
                new_state = self.get_referral_statuses(self.source_id, self.partner_id.email)['state']
                self.check_referral_progress('in_progress', new_state)
