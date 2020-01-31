from odoo import http
from odoo.http import request
from hashlib import md5


class Referral(http.Controller):

    @http.route(['/referral/generate_token'], type='json', auth='public', method='POST', website=True)
    def referral_unauth(self, **kwargs):
        #  TODO
        # if(saas):
        mail = request.env.user.partner_id.email
        dbuuid = request.env['ir.config_parameter'].sudo().get_param('database.uuid')
        c = md5((mail + dbuuid).encode('utf-8')).hexdigest()
        print(c)

        return {'token': c}
