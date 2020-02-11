from odoo import http
from odoo.http import request


class Referral(http.Controller):

    @http.route(['/referral/notifications_internal'], type='json', auth='user', method='POST', website=True)
    def referral_updates_count(self, **kwargs):
        result = request.env.user.get_referral_updates_count()
        return {'updates_count': request.env.user.referral_updates_count} if result > 0 else {}

    @http.route(['/referral/go'], type='json', auth='user', method='POST', website=True)
    def referral_go(self, **kwargs):
        request.env.user.referral_updates_count = 0
        return {'link': request.env.user.get_referral_link()}
