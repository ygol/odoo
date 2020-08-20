# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint

import werkzeug
from werkzeug import urls

from odoo import _, http
from odoo.exceptions import ValidationError
from odoo.http import request

from odoo.addons.payment.utils import toolbox as payment_toolbox

_logger = logging.getLogger(__name__)


class AdyenController(http.Controller):

    @http.route('/payment/adyen/payment_methods', type='json', auth='public')
    def payment_methods(
            self, acquirer_id, amount=None, currency_id=None, partner_id=None
    ):
        """ Query the available payment methods based on the transaction context.

        :param int acquirer_id: The acquirer handling the transaction, as a `payment.acquirer` id
        :param float|None amount: The transaction amount
        :param int|None currency_id: The transaction currency, as a `res.currency` id
        :param int|None partner_id: The partner making the transaction, as a `res.partner` id
        :return: The JSON-formatted content of the response
        :rtype: dict
        """
        acquirer_sudo = request.env['payment.acquirer'].browse(acquirer_id).sudo()
        currency_code = currency_id and request.env['res.currency'].browse(currency_id).name
        converted_amount = amount and currency_code and acquirer_sudo._adyen_convert_to_minor_units(
            amount, currency_code
        )
        partner_sudo = partner_id and request.env['res.partner'].browse(partner_id).sudo()
        partner_country_code = partner_sudo and partner_sudo.country_id.code
        # The lang is taken from the context rather than from the partner because it is not required
        # to be logged to make a payment and because the lang is not always set on the partner.
        # Adyen only supports a reduced set of languages but, instead of looking for the closest
        # match in https://docs.adyen.com/checkout/components-web/localization-components, we simply
        # provide the lang string as is (after adapting the format) and let Adyen find the best fit.
        lang_code = request.context.get('lang', 'en-US').replace('_', '-')
        shopper_reference = partner_sudo and f'ODOO_PARTNER_{partner_sudo.id}'
        data = {
            'merchantAccount': acquirer_sudo.adyen_merchant_account,
            'amount': converted_amount,
            'countryCode': partner_country_code,  # ISO 3166-1 alpha-2 (e.g.: 'BE')
            'shopperLocale': lang_code,  # IETF language tag (e.g.: 'fr-BE')
            'shopperReference': shopper_reference,
            'channel': 'Web',
        }
        response_content = acquirer_sudo._adyen_make_request(
            base_url=acquirer_sudo.adyen_checkout_api_url,
            endpoint_key='payment_methods',
            payload=data,
            method='POST'
        )
        return response_content

    @http.route('/payment/adyen/origin_key', type='json', auth='public')
    def origin_key(self, acquirer_id):
        """ Request an origin key based on the current domain.

        :param int acquirer_id: The acquirer handling the transaction, as a `payment.acquirer` id
        :return: The JSON-formatted content of the response
        :rtype: dict
        """
        acquirer_sudo = request.env['payment.acquirer'].browse(acquirer_id).sudo()
        domain = acquirer_sudo._get_base_url()
        data = {
            'originDomains': [domain],
        }
        response_content = acquirer_sudo._adyen_make_request(
            base_url=acquirer_sudo.adyen_checkout_api_url,
            endpoint_key='origin_keys',
            payload=data,
            method='POST'
        )
        return response_content

    @http.route('/payment/adyen/payments', type='json', auth='public')
    def process_payment(
            self, acquirer_id, reference, converted_amount, currency_id, partner_id,
            payment_method, browser_info, access_token
    ):
        """ Make a payment request and handle the response.

        :param int acquirer_id: The acquirer handling the transaction, as a `payment.acquirer` id
        :param str reference: The reference of the transaction
        :param int converted_amount: The amount of the transaction in minor units of the currency
        :param int currency_id: The currency of the transaction, as a `res.currency` id
        :param int partner_id: The partner making the transaction, as a `res.partner` id
        :param dict payment_method: The details of the payment method used for the transaction
        :param dict browser_info: The browser info to pass to Adyen
        :param str access_token: The access token used to verify the provided values
        :return: The JSON-formatted content of the response
        :rtype: dict
        """
        # Check that the transaction details have not been altered. This allows preventing users
        # from validating transactions by paying less than agreed upon.
        db_secret = request.env['ir.config_parameter'].sudo().get_param('database.secret')
        if not payment_toolbox.check_access_token(
            access_token, db_secret, reference, converted_amount, partner_id
        ):
            raise ValidationError("Adyen: " + _("Received tampered payment request data."))

        # Make the payment request to Adyen
        acquirer_sudo = request.env['payment.acquirer'].sudo().browse(acquirer_id)
        tx_sudo = request.env['payment.transaction'].sudo().search([('reference', '=', reference)])
        data = {
            'merchantAccount': acquirer_sudo.adyen_merchant_account,
            'amount': {
                'value': converted_amount,
                'currency': request.env['res.currency'].browse(currency_id).name,  # ISO 4217
            },
            'reference': reference,
            'paymentMethod': payment_method,
            'shopperReference': acquirer_sudo._adyen_compute_shopper_reference(partner_id),
            'recurringProcessingModel': 'CardOnFile',  # Most susceptible to trigger a 3DS check
            'shopperInteraction': 'Ecommerce',
            'storePaymentMethod': tx_sudo.tokenize,  # True by default on Adyen side
            'additionalData': {
                'allow3DS2': True
            },
            'channel': 'web',  # Required to support 3DS
            'origin': acquirer_sudo._get_base_url(),  # Required to support 3DS
            'browserInfo': browser_info,  # Required to support 3DS
            'returnUrl': urls.url_join(
                acquirer_sudo._get_base_url(),
                # Include the reference in the return url to be able to match it after redirection.
                # The key 'merchantReference' is chosen on purpose to be the same than that returned
                # by the /payments endpoint of Adyen.
                f'/payment/adyen/return?merchantReference={reference}'
            ),
        }
        response_content = acquirer_sudo._adyen_make_request(
            base_url=acquirer_sudo.adyen_checkout_api_url,
            endpoint_key='payments',
            payload=data,
            method='POST'
        )

        # Handle the payment request response
        _logger.info(f"payment request response:\n{pprint.pformat(response_content)}")
        request.env['payment.transaction'].sudo()._handle_feedback_data(
            dict(response_content, merchantReference=reference),  # Allow matching the transaction
            'adyen'
        )
        if 'action' in response_content and response_content['action']['type'] == 'redirect':
            tx_sudo.adyen_payment_data = response_content['paymentData']

        return response_content

    @http.route('/payment/adyen/payment_details', type='json', auth='public')
    def payment_details(self, acquirer_id, reference, details, payment_data):
        """ Query the status of a transaction that required additional actions and process it.

         The additional actions can have been performed both from the inline form or during a
         redirection.

        :param int acquirer_id: The acquirer handling the transaction, as a `payment.acquirer` id
        :param str reference: The reference of the transaction
        :param dict details: The specification of the additional actions
        :param str payment_data: The encrypted payment data of the transaction
        :return: The JSON-formatted content of the response
        :rtype: dict
        """
        # Make the payment details request to Adyen
        acquirer_sudo = request.env['payment.acquirer'].browse(acquirer_id).sudo()
        data = {
            'details': details,
            'paymentData': payment_data,
        }
        response_content = acquirer_sudo._adyen_make_request(
            base_url=acquirer_sudo.adyen_checkout_api_url,
            endpoint_key='payments_details',
            payload=data,
            method='POST'
        )

        # Handle the payment details request response
        _logger.info(f"payment details request response:\n{pprint.pformat(response_content)}")
        request.env['payment.transaction'].sudo()._handle_feedback_data(
            dict(response_content, merchantReference=reference),  # Allow matching the transaction
            'adyen'
        )

        return response_content

    @http.route('/payment/adyen/return', type='http', auth='public', csrf=False)  # TODO ANV log
    def return_from_redirect(self, **data):  # TODO test if redirected before /payments when /payment_methods returns redirect pms
        """ Process the data returned by Adyen after redirection.

        :param dict data: Feedback data. May include custom params sent to Adyen in the request to
                          allow matching the transaction when redirected here.
        """
        # Retrieve the transaction based on the reference included in the return url
        tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_data(data, 'adyen')
        # Query and process the result of the additional actions that have been performed
        self.payment_details(
            tx_sudo.acquirer_id.id,
            data['merchantReference'],
            {detail: value for detail, value in data.items() if detail != 'merchantReference'},
            tx_sudo.adyen_payment_data,
        )
        # Redirect the user to the status page
        return werkzeug.utils.redirect('/payment/status')

    # @http.route(
    #     '/payment/adyen/notification'
    # , type='http', auth='public', methods=['POST'], csrf=False)
    # def adyen_notification(self, **post):
    #     """ TODO. """
    #     tx = post.get('merchantReference') and request.env['payment.transaction'].sudo().search([('reference', 'in', [post.get('merchantReference')])], limit=1)
    #     if post.get('eventCode') == 'AUTHORISATION' and tx:
    #         states = (post.get('merchantReference'), post.get('success'), tx.state)
    #         if (post.get('success') == 'true' and tx.state == 'done') or (post.get('success') == 'false' and tx.state in ['cancel', 'error']):
    #             _logger.info('Notification from Adyen for the reference %s: received %s, state is %s', states)
    #         else:
    #             _logger.warning('Notification from Adyen for the reference %s: received %s but state is %s', states)
    #     return '[accepted]'
