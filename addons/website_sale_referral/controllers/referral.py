from odoo import http
from odoo.http import request
import uuid
import json

REWARD = 700  # hardcoded for now


class Referral(http.Controller):

    @http.route(['/referral'], type='http', auth='public', website=True)
    def referral_unauth(self, **kwargs):
        token = request.env.user.partner_id.referral_tracking_id.token if not request.website.is_public_user() else None
        if(not token):
            token = uuid.uuid4().hex  # Generate random token
        return request.redirect('/referral/' + token)

    @http.route(['/referral/<string:token>'], type='http', auth='public', website=True)
    def referral_auth(self, token, **post):
        if(not request.website.is_public_user() and request.env.user.partner_id.referral_tracking_id and request.env.user.partner_id.referral_tracking_id.token != token):
            request.redirect('/referral/' + request.env.user.partner_id.referral_tracking_id.token)

        if(True):  # TODO if('referrer_email' in post):
            referral_tracking = request.env['referral.tracking'].search([('token', '=', token)], limit=1)

            my_referrals = self._get_referral_status(referral_tracking[0].sudo().utm_source_id) if len(referral_tracking) else {}
            total_won = len(list(filter(lambda x: x == 'done', my_referrals.values())))
            total_won *= REWARD

            return request.render('website_sale_referral.referral_controller_template', {
                'token': token,
                'referrer_email': post.get('referrer_email') if request.website.is_public_user() else request.env.user.partner_id.email,
                'my_referrals': my_referrals,
                'total_won': total_won,
                'stages': request.env['referral.mixin'].REFERRAL_STAGES
            })
        else:
            return request.render('website_sale_referral.referral_controller_auth_template')

    @http.route(['/referral/send'], type='json', auth='public', method='POST', website=True)
    def referral_send(self, **post):
        referrer = post.get('referrer_email')
        token = post.get('token')

        ReferralTracking = request.env['referral.tracking']
        self.referral_tracking = ReferralTracking.search([('token', '=', token)], limit=1)
        if(len(self.referral_tracking)):
            self.referral_tracking = self.referral_tracking[0]
        else:
            utm_name = ('%s-%s') % (referrer, str(uuid.uuid4())[:6])
            utm_source_id = request.env['utm.source'].sudo().create({'name': utm_name})
            self.referral_tracking = request.env['referral.tracking'].sudo().create({
                'token': token,
                'utm_source_id': utm_source_id.id,
                'referrer_email': referrer
            })
            if(not request.website.is_public_user()):
                request.env.user.partner_id.update({'referral_tracking_id': self.referral_tracking.id})

        link_tracker = request.env['link.tracker'].sudo().create({
            'url': request.env['ir.config_parameter'].sudo().get_param('website_sale_referral.redirect_page') or request.env["ir.config_parameter"].sudo().get_param("web.base.url"),
            'campaign_id': request.env.ref('website_sale_referral.utm_campaign_referral').id,
            'source_id': self.referral_tracking.sudo().utm_source_id.id,
            'medium_id': request.env.ref('utm.utm_medium_%s' % post.get('channel')).id
        })

        template = request.env.ref('website_sale_referral.referral_tracker_email_template', False)
        template.sudo().send_mail(self.referral_tracking.id, force_send=True)

        return {'link': self._get_link_tracker_url(link_tracker, post.get('channel'))}

    def _get_referral_status(self, utm_source_id):
        result = request.env['sale.order'].sudo().get_referral_statuses(utm_source_id)
        return result

    def _get_link_tracker_url(self, link_tracker, channel):
        if channel == 'direct':
            return link_tracker.short_url
        if channel == 'facebook':
            return 'https://www.facebook.com/sharer/sharer.php?u=%s' % link_tracker.short_url
        elif channel == 'twitter':
            return 'https://twitter.com/intent/tweet?tw_p=tweetbutton&text=You have been refered Check here: %s' % link_tracker.short_url
        elif channel == 'linkedin':
            return 'https://www.linkedin.com/shareArticle?mini=true&url=%s' % link_tracker.short_url
