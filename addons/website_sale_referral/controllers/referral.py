from odoo import http
from odoo.http import request
import uuid


class Referral(http.Controller):

    @http.route('/referral', auth='public', website=True)
    def referral(self, **kwargs):
        return request.render('website_sale_referral.referral_controller_template')

    @http.route(['/referral/send'], type='http', auth='public', method='POST', website=True)
    def referral_send(self, **post):
        self.referrer = self._get_or_create_partner()
        url = self._compute_url(self.referrer, post.get('channel'))
        if post.get('channel') == 'direct':
            return request.redirect('/referral')
        else:
            return request.redirect(url)

    def _get_or_create_partner(self):
        if(request.env.user):
            return request.env.user.partner_id
        else:
            return request.env['res.partner'].sudo().create({'email': post.get('email')})

    def _compute_url(self, referrer, channel):
        if not referrer.utm_source_id:
            utm_name = ('%s-%s') % (referrer.name, str(uuid.uuid4())[:6])  # TODO what if no referrer.name
            referrer.utm_source_id = request.env['utm.source'].sudo().create({'name': utm_name}).id

        link_tracker = request.env['link.tracker'].sudo().create({
            'url': request.env["ir.config_parameter"].sudo().get_param("web.base.url"),
            'campaign_id': request.env.ref('website_sale_referral.utm_campaign_referral').id,
            'source_id': referrer.utm_source_id.id,
            'medium_id': request.env.ref('utm.utm_medium_%s' % channel).id
        })

        if channel == 'direct':
            return link_tracker.short_url
        elif channel == 'facebook':
            return 'https://www.facebook.com/sharer/sharer.php?u=%s' % link_tracker.short_url
        elif channel == 'twitter':
            return 'https://twitter.com/intent/tweet?tw_p=tweetbutton&text=You have been refered Check here: %s' % link_tracker.short_url
        elif channel == 'linkedin':
            return 'https://www.linkedin.com/shareArticle?mini=true&url=%s' % link_tracker.short_url
