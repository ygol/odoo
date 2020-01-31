from odoo import http
from odoo.http import request
import requests
from hashlib import md5
import uuid
from datetime import datetime, timedelta


class Referral(http.Controller):

    @http.route(['/referral/notifications_internal'], type='json', auth='user', method='POST', website=True)
    def referral_updates_count(self, **kwargs):
        if(True):  # TODO if(saas)
            if(not request.env.user.referral_updates_last_fetch_time or request.env.user.referral_updates_last_fetch_time > datetime.now() + timedelta(days=1)):
                dest_server_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')  # TODO use odoo.com
                payload = {
                    'jsonrpc': '2.0',
                    'method': 'call',
                    'params': {},
                    'id': uuid.uuid4().hex,
                }
                result = requests.post(dest_server_url + '/referral/notifications/' + self.get_token(), json=payload, headers={'content-type': 'application/json'}).json()
                request.env.user.referral_updates_last_fetch_time = datetime.now()
                if('result' in result and 'updates_count' in result['result']):
                    request.env.user.referral_updates_count = result['result']['updates_count']
                else:
                    request.env.user.referral_updates_count = -1
            else:
                if(request.env.user.referral_updates_count > -1):
                    result = {'result': {'updates_count': request.env.user.referral_updates_count}}
                else:
                    result = {}
        else:
            result = {}
        return result

    @http.route(['/referral/go'], type='json', auth='user', method='POST', website=True)
    def referral_go(self, **kwargs):
        request.env.user.referral_updates_count = 0
        dest_server_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')  # TODO use odoo.com
        token = self.get_token() if True else ''  # TODO  if(saas)
        return {'link': dest_server_url + '/referral/' + self.get_token()}

    def get_token(self):
        mail = request.env.user.partner_id.email
        dbuuid = request.env['ir.config_parameter'].sudo().get_param('database.uuid')
        return md5((mail + dbuuid).encode('utf-8')).hexdigest()
