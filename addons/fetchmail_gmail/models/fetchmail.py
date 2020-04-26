# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _
from odoo.exceptions import UserError
from imaplib import IMAP4, IMAP4_SSL
import base64


class FetchmailServer(models.Model):
    _inherit = 'fetchmail.server'

    is_gmail = fields.Boolean("gmail support", default=False)
    google_gmail_authorization_code = fields.Char(string='Authorization Code')
    google_gmail_uri = fields.Char(compute='_compute_gmail_uri', string='URI', help="The URL to generate the authorization code from Google")
    is_google_gmail_token_generated = fields.Boolean(string='Refresh Token Generated')

    @api.onchange('is_gmail')
    def _onchange_is_gmail(self):
        if self.is_gmail:
            self.server = "imap.gmail.com"
            self.server_type = "imap"
            self.is_ssl = True
        else:
            self.password = ""
            self.server = ""
            self.server_type = "pop"
            self.is_ssl = False

    @api.depends('google_gmail_authorization_code')
    def _compute_gmail_uri(self):
        google_gmail_uri = self.env['google.service']._get_google_token_uri('gmail', scope=self.env['google.gmail.config'].get_google_scope())
        for server in self:
            server.google_gmail_uri = google_gmail_uri

    @api.model
    def create(self, values):
        server = super(FetchmailServer, self).create(values)
        if server.is_gmail:
            if not server.server == "imap.gmail.com":
                raise UserError(_("For gmail, the server must be 'imap.gmail.com'"))
            if not server.server_type:
                raise UserError(_("For gmail, the server type must be IMAP"))
            refresh_token = (self.env['google.service'].generate_refresh_token('gmail', server.google_gmail_authorization_code))
            server.password = refresh_token
        return server

    def server_login(self, connection):
        if self.is_gmail:
            access_token = self.env['google.gmail.config'].get_access_token(self.password)
            auth_string = self.env['google.gmail.config'].generate_OAuth2_string(self.user, access_token)
            connection.authenticate('XOAUTH2', lambda x: auth_string)
            connection.select('INBOX')
        else:
            super(FetchmailServer, self).connect()
