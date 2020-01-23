from odoo import http, tools, SUPERUSER_ID
from odoo.http import request
from ast import literal_eval
import uuid
from odoo.addons.website_sale_referral.controllers.referral import Referral


class CrmReferral(Referral):

    @http.route(['/referral/send'], type='http', auth='public', method='POST', website=True)
    def referral_send(self, **post):
        r = super(CrmReferral, self).referral_send(**post)
        if(post.get('channel') == 'direct'):
            referred = request.env['res.partner'].sudo().find_or_create(
                tools.formataddr((post.get('name'), post.get('email')))
            )
            referred = request.env['res.partner'].browse(referred)
            referred.sudo().update({
                'name': post.get('name'),
                'phone': post.get('phone'),
            })

            lead_type = 'lead' if request.env['res.users'].with_user(SUPERUSER_ID).has_group('crm.group_use_lead') else 'opportunity'

            lead = request.env['crm.lead'].sudo().create({
                'name': 'Referral',
                'type': lead_type,
                'partner_id': referred.id,
                'user_id': literal_eval(request.env['ir.config_parameter'].sudo().get_param('website_sale_referral.salesperson')),
                'team_id': literal_eval(request.env['ir.config_parameter'].sudo().get_param('website_sale_referral.salesteam')),
                'tag_ids': [(6, 0, literal_eval(request.env['ir.config_parameter'].sudo().get_param('website_sale_referral.lead_tag_ids')))],
                'description': post.get('comment'),
                'source_id': self.referrer.utm_source_id.id,
                'campaign_id': request.env.ref('website_sale_referral.utm_campaign_referral').id,
                'medium_id': request.env.ref('utm.utm_medium_direct').id
            })
            self.referral_tracking.update({'lead_id': lead.id})

            return request.redirect('/referral')
        else:
            return r

    # OVERRIDE
    def _get_referral_status(self, request, referrer):
        if not request.env['res.users'].with_user(SUPERUSER_ID).has_group('website_crm_referral.group_lead_referral'):
            return super()._get_referral_status(request, referrer)

        return request.env['crm.lead'].sudo().get_referral_statuses(referrer)
