from odoo import http
from odoo.http import request
import uuid
from odoo.addons.website_sale_referral.controllers.referral import Referral


class CrmReferral(Referral):

    @http.route(['/referral/send'], type='http', auth='public', method='POST', website=True)
    def referral_send(self, **post):
        r = super(CrmReferral, self).referral_send(**post)
        if(post.get('channel') == 'direct'):
            referred = request.env['res.partner'].sudo().create({
                'name': post.get('name'),
                'email': post.get('email'),
                'phone': post.get('phone'),
            })

            lead_type = 'lead' if request.env['res.config.settings'].group_use_lead else 'opportunity'

            lead = request.env['crm.lead'].sudo().create({
                'name': 'Referral',
                'type': lead_type,
                'partner_id': referred.id,
                # TODO ?? 'user_id': self.user_id.id,
                'team_id': None,
                'description': post.get('comment'),
                'source_id': self.referrer.utm_source_id.id,
                'campaign_id': request.env.ref('website_sale_referral.utm_campaign_referral').id,
                'medium_id': request.env.ref('utm.utm_medium_direct').id
            })

            self.send_mail_to_referred(referred, self.link_tracker.short_url)

        return r

    def send_mail_to_referred(self, referred, link):
        template = request.env.ref('website_crm_referral.referral_email_template', False)  # TODO : do we still want a custom template ? request.env['res.config.settings'].mail_template_id
        template.sudo().with_context({'link': link}).send_mail(referred.id, force_send=True)

    # OVERRIDE
    def _get_referral_status(self, utm_source_id):
        if request.env['res.config.settings'].referral_reward_mode == 'sales_order':
            return super()._get_referral_status(utm_source_id)

        CrmLead = request.env['crm.lead']
        leads = CrmLead.search([
            ('campaign_id', '=', request.env.ref('website_sale_referral.utm_campaign_referral').id),
            ('source_id', '=', utm_source_id)])

        first_stage = request.env['crm.stage'].search([], limit=1).id  # ordered automatically by orm

        result = {}
        states_priority = {'cancel': 0, 'new': 1, 'in_progress': 2, 'done': 3}
        for l in leads:
            state = 'in_progress'
            if l.type == 'lead' or l.stage_id.id == first_stage:
                state = 'new'
            elif l.stage_id.is_won:
                state = 'done'
            elif l.stage_id.name == 'cancel':
                state = 'cancel'
            if(l.partner_id not in result or states_priority[state] > states_priority[result[so.partner_id]]):
                result[l.partner_id] = state
        return result
