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

    def get_referral_statuses(self, utm_source_id, referred_email=None):
        objects = self.find_others(utm_source_id, referred_email)

        result = {}
        for o in objects:
            state = o._get_state_for_referral()
            if(o.referred_email not in result or self.STATES_PRIORITY[state] > self.STATES_PRIORITY[result[o.referred_email]['state']]):
                result[o.referred_email] = {'state': state, 'name': o.referred_name, 'company': o.referred_company}

        if referred_email:
            return result.get(referred_email, None)
        else:
            return result

    def check_referral_progress(self, old_state, new_state):
        others_to_reward = self.find_others(self.source_id, referred_email=self.referred_email, extra_criteria=[('to_reward', '=', True)])
        if new_state != old_state and not len(others_to_reward):
            self.get_referral_tracking().updates_count += 1
            if new_state == 'done':
                self._send_mail('referral_won_email_template', 'Referral won !', {'referred_name': self.referred_name})

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
                self._send_mail('referral_cancelled_email_template', 'Referral lost...', {'referred_name': self.referred_name})
            else:
                self._send_mail('referral_state_changed_email_template', 'Referral progressed !', {'referred_name': self.referred_name, 'state': _(self.REFERRAL_STAGES[new_state])})

    def find_others(self, utm_source_id, referred_email=None, extra_criteria=[]):
        criteria = [
            ('campaign_id', '=', self.env.ref('website_sale_referral.utm_campaign_referral').id),
            ('source_id', '=', utm_source_id.id)]
        if(referred_email):
            criteria.append(('referred_email', '=', referred_email))
        if(extra_criteria):
            criteria.extend(extra_criteria)
        return self.search(criteria)

    def get_referral_tracking(self):
        return self.env['referral.tracking'].search([('utm_source_id', '=', self.source_id.id)], limit=1)  # TODO if this crashes again, there is a problem with the domain. If not in a few time, then delete this comment

    def _send_mail(self, template, subject, render_context):
        template = self.env.ref('website_sale_referral.' + template)
        mail_body = template.render(render_context, engine='ir.qweb', minimal_qcontext=True)
        mail = self.env['mail.mail'].sudo().create({
            'subject': subject,
            'email_to': self.get_referral_tracking().referrer_email,
            'email_from': None,
            'body_html': mail_body,
        })
        mail.send()
