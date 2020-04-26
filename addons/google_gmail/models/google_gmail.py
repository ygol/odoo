# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import ast
import logging
import json
import re
import base64

import requests
import werkzeug.urls

from odoo import api, fields, models
from odoo.exceptions import RedirectWarning, UserError
from odoo.tools.translate import _

from odoo.addons.google_account.models.google_service import GOOGLE_TOKEN_ENDPOINT, TIMEOUT

_logger = logging.getLogger(__name__)


class GoogleGmail(models.Model):

    _name = 'google.gmail.config'
    _description = "Google Gmail templates config"

    google_gmail_client_id = fields.Char('Google Client', compute='_compute_gmail_client_id')

    @api.model
    def get_access_token(self, refresh_token):
        Config = self.env['ir.config_parameter'].sudo()
        user_is_admin = self.env.is_admin()
        if not refresh_token:
            if user_is_admin:
                raise UserError(_("The refresh token for authentication is not set"))
            else:
                raise UserError(_("Google Gmail is not yet configured. Please contact your administrator."))

        google_gmail_client_id = Config.get_param('google_gmail_client_id')
        google_gmail_client_secret = Config.get_param('google_gmail_client_secret')

        # For Getting New Access Token With help of old Refresh Token
        data = {
            'client_id': google_gmail_client_id,
            'refresh_token': refresh_token,
            'client_secret': google_gmail_client_secret,
            'grant_type': "refresh_token",
            'scope': self.get_google_scope()
        }
        headers = {"Content-type": "application/x-www-form-urlencoded"}
        try:
            req = requests.post(GOOGLE_TOKEN_ENDPOINT, data=data, headers=headers, timeout=TIMEOUT)
            req.raise_for_status()
        except requests.HTTPError:
            if user_is_admin:
                raise UserError(_("Something went wrong during the token generation. Please request again an authorization code ."))
            else:
                raise UserError(_("Google Gmail is not yet configured. Please contact your administrator."))
        return req.json().get('access_token')

    def _compute_gmail_client_id(self):
        google_gmail_client_id = self.env['ir.config_parameter'].sudo().get_param('google_gmail_client_id')
        for record in self:
            record.google_gmail_client_id = google_gmail_client_id

    def get_google_scope(self):
        return 'https://mail.google.com/'

    def generate_OAuth2_string(self, user, access_token):
        """Args:
            username: the username (email address) of the account to authenticate
            access_token: An OAuth2 access token.
        Returns:
            The SASL argument for the OAuth2 mechanism.
        """
        return 'user=%s\1auth=Bearer %s\1\1' % (user, access_token)

