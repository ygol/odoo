from odoo import http
from odoo.http import request
import uuid


class Referral(http.Controller):

    @http.route('/referral', auth='public', website=True)
    def referral(self, **kwargs):
        return request.render('website_sale_referral.referral_controller_template')

    @http.route(['/referral/send'], type='http', auth='public', method='POST', website=True)
    def referral_send(self, **post):
        referrer = self._get_or_create_partner()
        url = self._compute_url(referrer, post.get('channel'))
        if(post.get('channel') == 'direct'):
            referred = request.env['res.partner'].sudo().create({
                'name': post.get('name'),
                'email': post.get('email'),
                'phone': post.get('phone'),
            })
            self.send_mail_to_referred(referred, url)
            return request.redirect('/referral')
        else:
            return request.redirect(url)

    def _get_or_create_partner(self):
        if(request.env.user):
            return request.env.user.partner_id
        else:
            return request.env['res.partner'].sudo().create({'email': post.get('email')})

    def _compute_url(self, user, channel):
        if not user.utm_source_id:
            utm_name = ('%s-%s') % (request.env.user.name, str(uuid.uuid4())[:6])
            user.utm_source_id = request.env['utm.source'].sudo().create({'name': utm_name}).id

        link_tracker = request.env['link.tracker'].sudo().create({
            'url': '/referral',  #TODO : page selected in settings
           #TODO 'campaign_id': 'customer_referral',
            'source_id': user.utm_source_id.id,
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

    def send_mail_to_referred(self, referred, link):
        template = request.env.ref('website_sale_referral.referral_email_template', False)  # TODO : do we still want a custom template ? request.env['res.config.settings'].mail_template_id
        template.sudo().with_context({'referred': referred, 'link': link}).send_mail(referred.id, force_send=True)
