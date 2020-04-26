# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
from odoo import fields, models, api, _
from odoo.exceptions import UserError
import smtplib

class IrMailServer(models.Model):
    """Represents an SMTP server, able to send outgoing emails, with SSL and TLS capabilities."""
    _inherit = "ir.mail_server"

    is_gmail = fields.Boolean("gmail support", default=False)
    google_gmail_authorization_code = fields.Char(string='Authorization Code', config_parameter='google_gmail_authorization_code')
    google_gmail_uri = fields.Char(compute='_compute_gmail_uri', string='URI', help="The URL to generate the authorization code from Google")
    is_google_gmail_token_generated = fields.Boolean(string='Refresh Token Generated')

    @api.onchange('is_gmail')
    def _onchange_is_gmail(self):
        if self.is_gmail:
            self.smtp_host = "smtp.gmail.com"
            self.smtp_encryption = "none"
        else:
            self.smtp_encryption = "ssl"
            self.smtp_pass = ""
            self.smtp_host = ""

    def server_login(self, connection, smtp_user, smtp_password, mail_server):
        if mail_server.is_gmail:
            access_token = self.env['google.gmail.config'].get_access_token(mail_server.smtp_pass)
            auth_string = self.env['google.gmail.config'].generate_OAuth2_string(mail_server.smtp_user, access_token)
            oauth_param = base64.b64encode(auth_string.encode("utf-8")).decode("utf-8")
            connection.ehlo('test')
            connection.docmd('AUTH', 'XOAUTH2 ' + oauth_param)
        else:
            super(IrMailServer, self).server_login(connection, smtp_user, smtp_password)

    @api.depends('google_gmail_authorization_code')
    def _compute_gmail_uri(self):
        google_gmail_uri = self.env['google.service']._get_google_token_uri('gmail', scope=self.env['google.gmail.config'].get_google_scope())
        for server in self:
            server.google_gmail_uri = google_gmail_uri

    @api.model
    def create(self, values):
        server = super(IrMailServer, self).create(values)
        if server.is_gmail:
            if not server.smtp_host == "smtp.gmail.com":
                raise UserError(_("For gmail, the server must be 'smtp.gmail.com'"))
            server._set_refresh_token_as_password()
        return server

    def _set_refresh_token_as_password(self):
        """"Everytime a connection is needed, this refresh token will be used
        to get a fresh access token. This should prevent any authentication failure."""
        if self.google_gmail_authorization_code:
            refresh_token = self.env['google.service'].generate_refresh_token('gmail', self.google_gmail_authorization_code)
            self.smtp_pass = refresh_token
