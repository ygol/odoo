from odoo import models, fields, api, _, SUPERUSER_ID

STATES_PRIORITY = {'cancel': 0, 'new': 1, 'in_progress': 2, 'done': 3}


class MailActivity(models.Model):
    _inherit = 'mail.activity'

    lead_id = fields.Many2one('crm.lead')

    def _action_done(self, feedback=False, attachment_ids=None):
        self.lead_id.partner_id.reward_done = True
        return super(MailActivity, self)._action_done(feedback=feedback, attachment_ids=attachment_ids)


class Lead(models.Model):
    _inherit = 'crm.lead'

    def get_referral_statuses(self, referrer, referred=None):
        criteria = [
            ('campaign_id', '=', self.env.ref('website_sale_referral.utm_campaign_referral').id),
            ('source_id', '=', referrer.sudo().utm_source_id.id)]
        if(referred):
            criteria.append(('partner_id', '=', referred.id))
        leads = self.search(criteria)

        result = {}
        for l in leads:
            state = l._get_state_for_referral()
            if(l.partner_id not in result or STATES_PRIORITY[state] > STATES_PRIORITY[result[l.partner_id]]):
                result[l.partner_id] = state

        if referred:
            return result.get(referred, None)
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
           not self.partner_id.referrer_to_reward_id and \
           any(elem in vals for elem in ['stage_id', 'type', 'active', 'probability']):
            referrer = self.env['res.partner'].search([('utm_source_id', '=', self.source_id.id)])
            old_state = self.get_referral_statuses(referrer, self.partner_id)
            r = super().write(vals)
            new_state = self.get_referral_statuses(referrer, self.partner_id)

            if new_state != old_state:
                if new_state == 'done':
                    template = self.env.ref('website_sale_referral.referral_won_email_template', False)
                    template.sudo().with_context({'referred': self.partner_id}).send_mail(referrer.id, force_send=True)

                    responsible_id = self.env['ir.config_parameter'].sudo().get_param('website_sale_referral.responsible_id') or SUPERUSER_ID
                    if responsible_id:
                        activity = self.activity_schedule(
                            act_type_xmlid='mail.mail_activity_data_todo',
                            summary='The referrer for this lead deserves a reward',
                            user_id=responsible_id)
                        activity.update({'lead_id': self.id})
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
