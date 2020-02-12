# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import SUPERUSER_ID
from odoo.http import request, route
import uuid
from odoo.addons.website_sale_referral.controllers.referral import Referral


class CrmReferral(Referral):

    @route(['/referral/send'], type='json', auth='public', method='POST')
    def referral_send(self, **post):
        r = super(CrmReferral, self).referral_send(**post)
        if(post.get('channel') == 'direct' and post.get('name') and post.get('email')):
            lead_type = 'lead' if request.env['res.users'].with_user(SUPERUSER_ID).has_group('crm.group_use_lead') else 'opportunity'

            lead = request.env['crm.lead'].sudo().create({
                'name': 'Referral for ' + post.get('name'),
                'type': lead_type,
                'contact_name': post.get('name'),
                'partner_name': post.get('company'),
                'phone': post.get('phone'),
                'email_from': post.get('email'),
                'description': post.get('comment'),
                'source_id': self.utm_source_id_id,
                'campaign_id': request.env.ref('website_sale_referral.utm_campaign_referral').id,
                'medium_id': request.env.ref('utm.utm_medium_direct').id
            })

            referral_tracking = lead.get_referral_tracking()
            partner_id = request.env['res.partner'].search([('referral_tracking_id', '=', referral_tracking.id)])
            referrer_name = partner_id.name if partner_id else referral_tracking.referrer_email
            template = request.env.ref('website_sale_referral.referral_tracker_email_template', False)
            ctx = {'referrer_name': referrer_name, 'referred_name': post.get('name')}
            template.sudo().with_context(ctx).send_mail(referral_tracking.id, force_send=True)

        return r

    # OVERRIDE
    def _get_referral_statuses(self, utm_source_id):
        if not request.env['res.users'].with_user(SUPERUSER_ID).has_group('website_crm_referral.group_lead_referral'):
            leads = request.env['crm.lead'].sudo().get_referral_statuses(utm_source_id)
            result = request.env['sale.order'].sudo().get_referral_statuses(utm_source_id)
            for k, v in leads.items():
                if(k not in result):
                    result[k] = {'state': 'new', 'name': v['name'], 'company': v['company']}
            return result

        return request.env['crm.lead'].sudo().get_referral_statuses(utm_source_id)
