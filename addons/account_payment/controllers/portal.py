# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account.controllers.portal import PortalAccount
from odoo.http import request


class PortalAccount(PortalAccount):

    def _invoice_get_page_view_values(self, invoice, access_token, **kwargs):
        values = super()._invoice_get_page_view_values(invoice, access_token, **kwargs)
        acquirers_sudo = request.env['payment.acquirer'].sudo()._get_compatible_acquirers(
            invoice.company_id.id or self.env.company.id,
            invoice.partner_id.id or self.env.user.partner_id.id,
        )  # In sudo mode to read on the partner fields if the user is not logged in
        values['acquirers'] = acquirers_sudo
        tokens = request.env['payment.token'].search([
            ('acquirer_id', 'in', acquirers_sudo.ids),
            ('partner_id', '=', invoice.partner_id.id or self.env.user.partner_id.id),
        ])
        logged_in = not request.env.user._is_public()
        if not logged_in:
            # we should not display payment tokens owned by the public user
            values['existing_token'] = bool(tokens)
            tokens = []
        values['tokens'] = tokens
        # If the current user is connected we set partner_id to his partner otherwise we set it as
        # the invoice partner. We do this to force the creation of payment tokens to the correct
        # partner and avoid linking tokens to the public user.
        values['partner_id'] = invoice.partner_id if not logged_in else request.env.user.partner_id
        return values
