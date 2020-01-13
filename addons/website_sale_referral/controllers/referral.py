from odoo import http
from odoo.http import request
import uuid

REFERRAL_STAGES = {'new': 'New', 'in_progress': 'In Progress', 'done': 'Done'}  # TODO refactof this and stages_priority


class Referral(http.Controller):

    @http.route('/referral/track', auth='public', website=True)
    def referral_track(self, access_token=None, **kwargs):
        if access_token:
            tracking = request.env['referral.tracking'].search([('token', '=', access_token)], limit=1)
            if not tracking:  # incorrect token
                return request.render('website.404')  # TODO fait nulle part dans odoo, autre façon de faire ? Ou afficher la page referral simple avec éventuellement un toast

            my_referrals = self._get_referral_status(tracking.referrer)
            referrer_to_signup = tracking.referrer
            if not request.website.is_public_user():
                # TODO if tracking.referrer != request.env.user.partner_id => merge ?
                referrer_to_signup = None
        else:
            if request.website.is_public_user():
                return request.render('website.404')
            else:
                my_referrals = self._get_referral_status(request.env.user.partner_id)
                referrer_to_signup = None

        return request.render('website_sale_referral.referral_track_controller_template', {
            'my_referrals': my_referrals,
            'stages': REFERRAL_STAGES,
            'referrer_to_signup': referrer_to_signup,
        })

    @http.route('/referral', auth='public', website=True)
    def referral(self, **kwargs):
        return request.render('website_sale_referral.referral_controller_template', {
            'my_referrals': self._get_referral_status(request.env.user.partner_id) if not request.website.is_public_user() else {},
            'stages': REFERRAL_STAGES})

    @http.route(['/referral/send'], type='http', auth='public', method='POST', website=True)
    def referral_send(self, **post):
        if not request.website.is_public_user():
            self.referrer = request.env.user.partner_id
            self.link_tracker = self._create_link_tracker(self.referrer, post.get('channel'))
            tracking_url_relative = '/referral'
        else:
            self.referrer = request.env['res.partner'].sudo().create({'name': post.get('email'), 'email': post.get('email')})
            self.link_tracker = self._create_link_tracker(self.referrer, post.get('channel'))
            referral_tracking = request.env['referral.tracking'].sudo().create({
                'referrer': self.referrer.id,
            })
            tracking_url_relative = '/referral/track?access_token=%s' % (referral_tracking.token)

        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        self.send_mail_to_referrer(self.referrer, base_url + tracking_url_relative)

        if post.get('channel') == 'direct':
            return request.redirect('/referral')
        else:
            return request.redirect(self._switch_link_tracker(post.get('channel')))  # TODO new window

    def send_mail_to_referrer(self, referrer, link):
        template = request.env.ref('website_sale_referral.referral_tracker_email_template', False)
        template.sudo().with_context({'link': link}).send_mail(referrer.id, force_send=True)

    def _get_referral_status(self, referrer):
        SaleOrder = request.env['sale.order']
        sales_orders = SaleOrder.search([
            ('campaign_id', '=', request.env.ref('website_sale_referral.utm_campaign_referral').id),
            ('source_id', '=', referrer.utm_source_id.id)])

        result = {}
        states_priority = {'cancel': 0, 'new': 1, 'in_progress': 2, 'done': 3}
        for so in sales_orders:
            state = 'in_progress'
            if so.state == 'draft' or so.state == 'sent':
                state = 'new'
            elif not so.has_to_be_paid():
                state = 'done'
            elif so.state == 'lost':
                state = 'cancel'
            if(so.partner_id not in result or states_priority[state] > states_priority[result[so.partner_id]]):
                result[so.partner_id] = state
        return result

    def _get_or_create_partner(self):
        if(request.env.user):
            return request.env.user.partner_id
        else:
            return request.env['res.partner'].sudo().create({'email': post.get('email')})

    def _create_link_tracker(self, referrer, channel):
        if not referrer.utm_source_id:
            utm_name = ('%s-%s') % (referrer.name, str(uuid.uuid4())[:6])  # TODO what if no referrer.name
            referrer.utm_source_id = request.env['utm.source'].sudo().create({'name': utm_name}).id

        return request.env['link.tracker'].sudo().create({
            'url': request.env["ir.config_parameter"].sudo().get_param("web.base.url"),
            'campaign_id': request.env.ref('website_sale_referral.utm_campaign_referral').id,
            'source_id': referrer.utm_source_id.id,
            'medium_id': request.env.ref('utm.utm_medium_%s' % channel).id
        })

    def _switch_link_tracker(self, channel):
        if channel == 'facebook':
            return 'https://www.facebook.com/sharer/sharer.php?u=%s' % self.link_tracker.short_url
        elif channel == 'twitter':
            return 'https://twitter.com/intent/tweet?tw_p=tweetbutton&text=You have been refered Check here: %s' % self.link_tracker.short_url
        elif channel == 'linkedin':
            return 'https://www.linkedin.com/shareArticle?mini=true&url=%s' % self.link_tracker.short_url
