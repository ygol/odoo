from odoo import http
from odoo.http import request


class Referral(http.Controller):

    @http.route('/referral/notifications/<string:token>', type='json', auth='public', website=True)
    def referral_notifications(self, token, **kwargs):
        referral_tracking = request.env['referral.tracking'].search([('token', '=', token)], limit=1)
        if(referral_tracking):
            num_notif = referral_tracking.updates_count
            referral_tracking.sudo().updates_count = 0
            return {'updates_count': num_notif}
        else:
            return {}
