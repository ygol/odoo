from odoo import api, models, fields
import requests
from hashlib import md5
import uuid
from datetime import datetime, timedelta

DEST_SERVER_URL = 'https://www.odoo.com'


class Users(models.Model):
    _inherit = 'res.users'

    referral_updates_last_fetch_time = fields.Datetime(description='The last time the referral updates were fetched from odoo.com')
    referral_updates_count = fields.Integer(default=-1)

    def get_referral_updates_count(self):
        if(not self.referral_updates_last_fetch_time or self.referral_updates_last_fetch_time > datetime.now() + timedelta(days=1)):
            payload = {
                'jsonrpc': '2.0',
                'method': 'call',
                'params': {},
                'id': uuid.uuid4().hex,
            }
            result = requests.post(DEST_SERVER_URL + '/referral/notifications/' + self.get_referral_token(), json=payload, headers={'content-type': 'application/json'}).json()
            self.referral_updates_last_fetch_time = datetime.now()
            if('result' in result and 'updates_count' in result['result']):
                self.referral_updates_count = result['result']['updates_count']
            else:
                self.referral_updates_count = -1
        return self.referral_updates_count

    def get_referral_token(self):
        mail = self.partner_id.email
        dbuuid = self.env['ir.config_parameter'].sudo().get_param('database.uuid')
        return md5((mail + dbuuid).encode('utf-8')).hexdigest()

    def get_referral_link(self):
        return DEST_SERVER_URL + '/referral/register?token=' + self.get_referral_token() + '&referrer_email=' + self.partner_id.email
