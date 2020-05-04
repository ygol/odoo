# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account.controllers.portal import PortalAccount
from odoo.http import request


class PortalAccount(PortalAccount):

    def _invoice_get_page_view_values(self, invoice, access_token, **kwargs):

        def _get_available_payment_options(_partner=None, _company=None):
            """
            Generic (model) method that fetches available payment mechanisms
            to use in all portal / eshop pages that want to use the payment form.

            It contains

             * acquirers: record set of both redirect and S2S acquirers;
             * pms: record set of stored payment method details (aka payment.token)
                    connected to a given partner to allow customers to reuse them """
            if not _company:
                _company = self.env.company
            if not _partner:
                _partner = self.env.user.partner_id

            domain = ['&', ('state', 'in', ['enabled', 'test']), ('company_id', '=', _company.id)]
            if _partner.sudo().country_id:
                domain = expression.AND([
                    domain,
                    ['|', ('country_ids', '=', False), ('country_ids', 'in', [_partner.sudo().country_id.id])]
                ])
            active_acquirers = self.search(domain)
            acquirers = active_acquirers.filtered(lambda acq: (acq.payment_flow == 'redirect' and acq.redirect_template_view_id) or
                                                              (acq.payment_flow == 's2s' and acq.inline_template_view_id))
            return {
                'acquirers': acquirers,
                'pms': self.env['payment.token'].search([
                    ('partner_id', '=', _partner.id),
                    ('acquirer_id', 'in', acquirers.ids)]),
            }

        values = super(PortalAccount, self)._invoice_get_page_view_values(invoice, access_token, **kwargs)
        payment_inputs = _get_available_payment_options(invoice.partner_id, invoice.company_id)
        # if not connected (using public user), the method _get_available_payment_input will return public user tokens
        # we dispose them since tokens should not be shared
        is_public_user = request.env.user._is_public()
        if is_public_user:
            # we should not display payment tokens owned by the public user
            payment_inputs.pop('pms', None)
            token_count = request.env['payment.token'].sudo().search_count([('acquirer_id.company_id', '=', invoice.company_id.id),
                                                                      ('partner_id', '=', invoice.partner_id.id),
                                                                    ])
            values['existing_token'] = token_count > 0
        values.update(payment_inputs)
        # if the current user is connected we set partner_id to his partner otherwise we set it as the invoice partner
        # we do this to force the creation of payment tokens to the correct partner and avoid token linked to the public user
        values['partner_id'] = invoice.partner_id if is_public_user else request.env.user.partner_id,
        return values
