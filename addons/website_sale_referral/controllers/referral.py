from odoo import http
from odoo.http import request
import uuid
import json

REFERRAL_STAGES = {'new': 'New', 'in_progress': 'In Progress', 'done': 'Done'}  # TODO refactof this and stages_priority
REWARD = 700  # hardcoded for now


class Referral(http.Controller):

    @http.route(['/reft'], auth='public', website=True)
    def referral_test(self, **kwargs):
        return request.render('website_sale_referral.referral_widget_test')

    @http.route(['/referral/track'], auth='public', website=True)
    def referral_track(self, access_token=None, **kwargs):
        if access_token:
            tracking = request.env['referral.tracking'].search([('token', '=', access_token)], limit=1)
            if not tracking:  # incorrect token
                return request.not_found()

            my_referrals = self._get_referral_status(request, tracking.referrer_id)
            referrer_to_signup = tracking.referrer_id
            if not request.website.is_public_user():
                # TODO if tracking.referrer_id != request.env.user.partner_id => merge ?
                referrer_to_signup = None
        else:
            if request.website.is_public_user():
                return request.not_found()
            else:
                my_referrals = self._get_referral_status(request, request.env.user.partner_id)
                referrer_to_signup = None

        total_won = len(list(filter(lambda x: x == 'done', my_referrals.values())))
        total_won *= REWARD
        return request.render('website_sale_referral.referral_track_controller_template', {
            'my_referrals': my_referrals,
            'total_won': total_won,
            'stages': REFERRAL_STAGES,
            'referrer_to_signup': referrer_to_signup,
        })

    @http.route(['/referral', '/my/referral'], auth='public', website=True)
    def referral(self, **kwargs):
        my_referrals = self._get_referral_status(request, request.env.user.partner_id) if not request.website.is_public_user() else {}
        total_won = len(list(filter(lambda x: x == 'done', my_referrals.values())))
        total_won *= REWARD
        return request.render('website_sale_referral.referral_controller_template', {
            'my_referrals': my_referrals,
            'total_won': total_won,
            'stages': REFERRAL_STAGES})

    @http.route(['/referral/send'], type='json', auth='public', method='POST', website=True)
    def referral_send(self, **post):
        if not request.website.is_public_user():
            self.referrer = request.env.user.partner_id
        else:
            self.referrer = request.env['res.partner'].sudo().create({'name': post.get('referrer_email').split('@')[0], 'email': post.get('referrer_email')})
        self.link_tracker = self._create_link_tracker(self.referrer, post.get('channel'))
        self.referral_tracking = request.env['referral.tracking'].sudo().create({
            'referrer_id': self.referrer.id,
        })
        tracking_url_relative = '/referral/track?access_token=%s' % (self.referral_tracking.token)

        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        template = request.env.ref('website_sale_referral.referral_tracker_email_template', False)
        template.sudo().with_context({'link': base_url + tracking_url_relative}).send_mail(self.referrer.id, force_send=True)

        return {'link': self._get_link_tracker_url(self.link_tracker, post.get('channel'))}

    def _get_referral_status(self, request, referrer):
        return request.env['sale.order'].sudo().get_referral_statuses(referrer)

    def _create_link_tracker(self, referrer, channel):
        if not referrer.utm_source_id:
            utm_name = ('%s-%s') % (referrer.name, str(uuid.uuid4())[:6])  # TODO what if no referrer.name
            referrer.utm_source_id = request.env['utm.source'].sudo().create({'name': utm_name}).id

        return request.env['link.tracker'].sudo().create({
            'url': request.env['ir.config_parameter'].sudo().get_param('website_sale_referral.redirect_page') or request.env["ir.config_parameter"].sudo().get_param("web.base.url"),
            'campaign_id': request.env.ref('website_sale_referral.utm_campaign_referral').id,
            'source_id': referrer.utm_source_id.id,
            'medium_id': request.env.ref('utm.utm_medium_%s' % channel).id
        })

    def _get_link_tracker_url(self, link_tracker, channel):
        if channel == 'direct':
            return link_tracker.short_url
        if channel == 'facebook':
            return 'https://www.facebook.com/sharer/sharer.php?u=%s' % link_tracker.short_url
        elif channel == 'twitter':
            return 'https://twitter.com/intent/tweet?tw_p=tweetbutton&text=You have been refered Check here: %s' % link_tracker.short_url
        elif channel == 'linkedin':
            return 'https://www.linkedin.com/shareArticle?mini=true&url=%s' % link_tracker.short_url
