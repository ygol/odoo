from odoo import api, fields, models, _, SUPERUSER_ID


class MailActivity(models.Model):
    _inherit = 'mail.activity'

    def _action_done(self, feedback=False, attachment_ids=None):
        obj = self.env[self.res_model].browse(self.res_id)
        obj.reward_done = True
        return super(MailActivity, self)._action_done(feedback=feedback, attachment_ids=attachment_ids)


class ReferralMixin(models.AbstractModel):
    """ Mixin class for objects which can be tracked by referral. """
    _name = 'referral.mixin'
    _description = 'Referral Mixin'

    STATES_PRIORITY = {'cancel': 0, 'new': 1, 'in_progress': 2, 'done': 3}
    REFERRAL_STAGES = {'new': 'New', 'in_progress': 'In Progress', 'done': 'Done'}

    to_reward = fields.Boolean()
    reward_done = fields.Boolean()

    def find(self, utm_source_id, referred_email=None, extra_criteria=[]):
        criteria = [
            ('campaign_id', '=', self.env.ref('website_sale_referral.utm_campaign_referral').id),
            ('source_id', '=', utm_source_id.id)]
        if(referred_email):
            criteria.append(('referral_email', '=', referred_email))
        if(extra_criteria):
            criteria.extend(extra_criteria)
        return self.search(criteria)

    def check_referral_progress(self, old_state, new_state):
        other_objects = self.find(self.source_id, referred_email=self.referral_email, extra_criteria=[('to_reward', '=', True)]) #TODO exclude self
        print('CHECKING referral_mixin', old_state, new_state)
        if new_state != old_state and not len(other_objects):
            #referrer.referral_updates += 1
            if new_state == 'done':
                # template = self.env.ref('website_sale_referral.referral_won_email_template', False)
                # template.sudo().with_context({'referred': self.email_from}).send_mail(referrer.id, force_send=True)

                responsible_id = self.env['ir.config_parameter'].sudo().get_param('website_sale_referral.responsible_id') or SUPERUSER_ID
                if responsible_id:
                    activity = self.activity_schedule(
                        act_type_xmlid='website_sale_referral.mail_act_data_referral_reward',
                        summary='The referrer for this lead deserves a reward',
                        user_id=responsible_id)
                    if(callable(getattr(self, 'activity_created', None))):
                        self.activity_created(activity)
                    self.to_reward = True

            elif new_state == 'cancel':
                pass
                # template = self.env.ref('website_sale_referral.referral_cancelled_email_template', False)
                # template.sudo().with_context({'referred': self.partner_id}).send_mail(referrer.id, force_send=True)

            else:
                pass
                # template = self.env.ref('website_sale_referral.referral_state_changed_email_template', False)
                # template.sudo().with_context({'referred': self.partner_id, 'state': _(new_state)}).send_mail(referrer.id, force_send=True)
