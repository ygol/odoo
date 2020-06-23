# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import uuid
import requests
import hmac
import threading

from hashlib import sha1
from werkzeug import url_encode

from odoo import api, models, tools


DEST_SERVER_URL = 'https://www.odoo.com'
_logger = logging.getLogger(__name__)


class Users(models.Model):
    _inherit = 'res.users'

    def _get_or_generate_referral_token(self):
        self.ensure_one()
        db_secret = self.env['ir.config_parameter'].sudo().get_param('database.secret').encode('utf-8')
        db_uuid = self.env['ir.config_parameter'].sudo().get_param('database.uuid')
        message = (db_uuid + self.env.user.email).encode('utf-8') 
        return hmac.new(db_secret, message, sha1).hexdigest()

    def _get_referral_link(self, reset_count=False):
        self.ensure_one()
        params = {
            'token': self._get_or_generate_referral_token(),
            'referrer_email': self.partner_id.email,
        }
        if reset_count:
            params['reset_count'] = 1

        return DEST_SERVER_URL + '/referral/register?' + url_encode(params)
