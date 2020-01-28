from odoo import models, fields, api, _, SUPERUSER_ID


class Lead(models.Model):
    _name = 'crm.lead'
    _inherit = ['crm.lead', 'referral.mixin']

    referral_email = fields.Char(string="Referral email", related='email_from', description="The email used to identify the refered")

    def get_referral_statuses(self, utm_source_id, referred_email=None):
        leads = self.find(utm_source_id, referred_email)

        result = {}
        for l in leads:
            state = l._get_state_for_referral()
            if(l.email_from not in result or self.STATES_PRIORITY[state] > self.STATES_PRIORITY[result[l.email_from]]):
                result[l.email_from] = state

        if referred_email:
            return result.get(referred_email, None)
        else:
            return result

    def _get_state_for_referral(self):
        self.ensure_one()
        first_stage = self.env['crm.stage'].search([], limit=1).id  # ordered automatically by orm
        r = 'in_progress'
        if not self.active and self.probability == 0:
            r = 'cancel'
        elif self.type == 'lead' or self.stage_id.id == first_stage:
            r = 'new'
        elif self.stage_id.is_won:
            r = 'done'
        return r

    def write(self, vals):
        if self.env.user.has_group('website_crm_referral.group_lead_referral') and \
           not self.to_reward and \
           any([elem in vals for elem in ['stage_id', 'type', 'active', 'probability']]):
            old_state = self.get_referral_statuses(self.source_id, self.email_from)
            r = super().write(vals)
            new_state = self.get_referral_statuses(self.source_id, self.email_from)

            self.check_referral_progress(old_state, new_state)

            return r
        else:
            return super().write(vals)
