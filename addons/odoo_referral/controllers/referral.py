from odoo import http
from odoo.http import request


class Referral(http.Controller):

    @http.route(['/referral/go'], type='json', auth='public', method='POST')
    def referral_unauth(self, **kwargs):
        #TODO
        # if(saas):
        #     return {'token': checksum(nom + dbuuid)}
        return {}
