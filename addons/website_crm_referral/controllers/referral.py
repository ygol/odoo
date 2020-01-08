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
            })
            #TODO stage if no default

        return r
