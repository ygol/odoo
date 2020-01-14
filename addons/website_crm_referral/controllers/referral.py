from odoo import http, tools, SUPERUSER_ID
from odoo.http import request
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
                # TODO ?? 'user_id': self.user_id.id,
                'team_id': None,
                'description': post.get('comment'),
                'source_id': self.referrer.utm_source_id.id,
                'campaign_id': request.env.ref('website_sale_referral.utm_campaign_referral').id,
                'medium_id': request.env.ref('utm.utm_medium_direct').id
            })
            self.referral_tracking.update({'lead_id': lead.id})

            decline_url_relative = '/referral/decline?access_token=%s' % (self.referral_tracking.token)
            base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
            template = request.env.ref('website_crm_referral.referral_email_template', False)  # TODO : do we still want a custom template ? request.env['res.config.settings'].mail_template_id
            template.sudo().with_context({'link': self.link_tracker.short_url, 'decline_url': base_url + decline_url_relative}).send_mail(referred.id, force_send=True)

        return r

    @http.route(['/referral/decline'], type="http", auth='public', method='POST', website=True)
    def referral_decline(self, access_token, **post):
        tracking = request.env['referral.tracking'].search([('token', '=', access_token)], limit=1)
        if not tracking:  # incorrect token
            return request.not_found()

        tracking.lead_id.sudo().action_set_lost(lost_reason=request.env.ref('website_crm_referral.lost_reason_cancel_by_referred')) #TODO send email

        return request.redirect('')

    # OVERRIDE
    def _get_referral_status(self, request, referrer):
        #if request.env['res.config.settings'].referral_reward_mode == 'sales_order':
            #return super()._get_referral_status(utm_source_id)

        return request.env['crm.lead'].sudo().get_referral_statuses(referrer)
