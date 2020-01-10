from odoo import http
from odoo.http import request
import uuid

REFERRAL_STAGES = {'new': 'New', 'in_progress': 'In Progress', 'done': 'Done'}  # TODO refactof this and stages_priority


class Referral(http.Controller):

    @http.route('/referral/<string:token>', auth='public', website=True)
    def referral_tracking(self, token, **kwargs):
        tracking = request.env['referral.tracking']
        tracking = tracking.search([('token', '=', token)], limit=1)
        if(not tracking):
            return request.render('website.404')  # TODO fait nulle part dans odoo, autre façon de faire ?
        else:  # TODO plutôt renvoyer vers une page custom avec le signup
            return request.render('website_sale_referral.referral_controller_template', {
                'my_referrals': self._get_referral_status(tracking.referrer.utm_source_id),
                'stages': REFERRAL_STAGES
            })

    @http.route('/referral', auth='public', website=True)
    def referral(self, **kwargs):
        return request.render('website_sale_referral.referral_controller_template', {
            'my_referrals': self._get_referral_status(request.env.user.partner_id.utm_source_id.id) if request.env.user else {},
            'stages': REFERRAL_STAGES})

    @http.route(['/referral/send'], type='http', auth='public', method='POST', website=True)
    def referral_send(self, **post):
        self.referrer = self._get_or_create_partner()
        url = self._create_link_tracker(self.referrer, post.get('channel'))

        referral_tracking = request.env['referral.tracking'].sudo().create({
            'referrer_utm_source_id': self.link_tracker.source_id.id,
        })
        self.send_mail_to_referrer(self.referrer, "http://localhost/referral/token")  # TODO

        if post.get('channel') == 'direct':
            return request.redirect('/referral')
        else:
            return request.redirect(url)

    def _get_referral_status(self, utm_source_id):
        SaleOrder = request.env['sale.order']
        sales_orders = SaleOrder.search([
            ('campaign_id', '=', request.env.ref('website_sale_referral.utm_campaign_referral').id),
            ('source_id', '=', utm_source_id)])

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

        self.link_tracker = request.env['link.tracker'].sudo().create({
            'url': request.env["ir.config_parameter"].sudo().get_param("web.base.url"),
            'campaign_id': request.env.ref('website_sale_referral.utm_campaign_referral').id,
            'source_id': referrer.utm_source_id.id,
            'medium_id': request.env.ref('utm.utm_medium_%s' % channel).id
        })

        if channel == 'direct':
            return self.link_tracker.short_url
        elif channel == 'facebook':
            return 'https://www.facebook.com/sharer/sharer.php?u=%s' % self.link_tracker.short_url
        elif channel == 'twitter':
            return 'https://twitter.com/intent/tweet?tw_p=tweetbutton&text=You have been refered Check here: %s' % self.link_tracker.short_url
        elif channel == 'linkedin':
            return 'https://www.linkedin.com/shareArticle?mini=true&url=%s' % self.link_tracker.short_url

    def send_mail_to_referrer(self, referrer, link):
        template = request.env.ref('website_sale_referral.referral_tracker_email_template', False)
        template.sudo().with_context({'link_tracking': link}).send_mail(referrer.id, force_send=True)
