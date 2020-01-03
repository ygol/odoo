from odoo import models, fields


class Lead(models.Model):
    _inherit = 'crm.lead'

    referral_id = fields.Many2one('website_crm_referral.referral')
    to_be_rewarded = fields.Boolean()

    def write(self, vals):
        if(self.referral_id):
            stages = sorted(self.referral_id.campaign_id.crm_stages, key=lambda s: s.sequence)
            stages = [s.id for s in stages]

            if stages and 'stage_id' in vals:
                if vals['stage_id'] == stages[-1]:
                    if not self.to_be_rewarded:
                        vals.update({'to_be_rewarded': True})
                        self.referral_id.send_mail_update_to_referrer('referral_won_email_template')
                elif vals['stage_id'] in stages and vals['stage_id'] != stages[0]:  # we only send a mail if the new stage is specified in the config and not the first stage
                    self.referral_id.send_mail_update_to_referrer('referral_stage_changed_email_template')

            if not vals.get('active', True) and vals.get('probability', 1) == 0:  # marked as lost
                self.referral_id.send_mail_update_to_referrer('referral_cancel_email_template')

        return super().write(vals)
