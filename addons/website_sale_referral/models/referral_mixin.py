# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, SUPERUSER_ID
from odoo.osv import expression


# class MailActivity(models.Model):
#     _inherit = 'mail.activity'

#     def _action_done(self, feedback=False, attachment_ids=None):
#         obj = self.env[self.res_model].browse(self.res_id)
#         if 'reward_done' in obj:
#             obj.reward_done = True
#         return super(MailActivity, self)._action_done(feedback=feedback, attachment_ids=attachment_ids)


class ReferralMixin(models.AbstractModel):
    """ Mixin class for objects which can be tracked by referral. """
    _name = 'referral.mixin'
    _description = 'Referral Mixin'

    STATES_PRIORITY = {'cancel': 0, 'new': 1, 'in_progress': 2, 'done': 3}
    REFERRAL_STAGES = {'new': 'New', 'in_progress': 'In Progress', 'done': 'Done'}

    deserve_reward = fields.Boolean()
    reward_done = fields.Boolean()

    @api.model
    def get_referral_statuses(self, utm_source_id, referred_email=None):
        objects = self._find_other_referrals(utm_source_id, referred_email)

        result = {}
        for o in objects:
            state = o._get_state_for_referral()
            if(o.referred_email not in result or self.STATES_PRIORITY[state] > self.STATES_PRIORITY[result[o.referred_email]['state']]):
                result[o.referred_email] = {
                    'state': state,
                    'name': o.referred_name or '',
                    'company': o.referred_company_name or '',
                    'date': o.create_date
                }

        if referred_email:
            return result.get(referred_email, None)
        else:
            return result

    def check_referral_progress(self, old_state, new_state):
        self.ensure_one()
        others_deserve_reward = self._find_other_referrals(self.source_id, referred_email=self.referred_email, deserve_reward=True)

        if new_state == old_state or len(others_deserve_reward):
            return

        referral_tracking = self.get_referral_tracking()
        referral_tracking.updates_count += 1
        if new_state == 'done':
            self._send_mail(
                'referral_won_email_template',
                'Referral won !',
                {'referred_name': self.referred_name})

            responsible_id = self.env['ir.config_parameter'].sudo().get_param('website_sale_referral.responsible_id') or SUPERUSER_ID
            activity = self.activity_schedule(
                act_type_xmlid='website_sale_referral.mail_act_data_referral_reward',
                summary='The referrer for this lead deserves a reward',
                user_id=responsible_id)
            self.deserve_reward = True

    @api.model
    def _find_other_referrals(self, utm_source_id, referred_email=None, deserve_reward=False):
        domain = [
            ('campaign_id', '=', self.env.ref('website_sale_referral.utm_campaign_referral').id),
            ('source_id', '=', utm_source_id.id)]
        if(referred_email):
            domain = expression.AND([domain, [('referred_email', '=', referred_email)]])
        if(deserve_reward):
            domain = expression.AND([domain, [('deserve_reward', '=', deserve_reward)]])
        return self.search(domain)

    def get_referral_tracking(self):
        self.ensure_one()
        return self.env['referral.tracking'].search([('utm_source_id', '=', self.source_id.id)], limit=1)

    def _send_mail(self, template, subject, render_context):
        self.ensure_one()
        if('referred_name' not in render_context):
            render_context['referred_name'] = self.referred_name

        referral_tracking = self.get_referral_tracking()
        if('referrer_name' not in render_context):
            partner_id = self.env['res.partner'].search([('referral_tracking_id', '=', referral_tracking.id)])
            render_context['referrer_name'] = partner_id.name if partner_id else referral_tracking

        template = self.env.ref('website_sale_referral.' + template)
        mail_body = template.render(render_context, engine='ir.qweb', minimal_qcontext=True)
        mail = self.env['mail.mail'].sudo().create({
            'subject': subject,
            'email_to': referral_tracking.referrer_email,
            'email_from': None,
            'body_html': mail_body,
        })
        mail.send()
