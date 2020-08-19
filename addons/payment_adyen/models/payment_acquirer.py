# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import re

import requests

from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools import float_round

# Endpoints of the Checkout API.
# See https://docs.adyen.com/api-explorer/#/PaymentSetupAndVerificationService/v52/overview
API_ENDPOINTS = {
    'disable': {'path': '/disable', 'version': 49},
    'origin_keys': {'path': '/originKeys', 'version': 53},
    'payments': {'path': '/payments', 'version': 53},
    'payments_details': {'path': '/payments/details', 'version': 53},
    'payment_methods': {'path': '/paymentMethods', 'version': 53},
}

# Mapping of currency codes in ISO 4217 format to the number of decimals of the currency. If not
# listed, a currency has 2 decimals. See https://docs.adyen.com/development-resources/currency-codes
CURRENCY_DECIMALS = {
    'BHD': 3,
    'CVE': 0,
    'DJF': 0,
    'GNF': 0,
    'IDR': 0,
    'JOD': 3,
    'JPY': 0,
    'KMF': 0,
    'KRW': 0,
    'KWD': 3,
    'LYD': 3,
    'OMR': 3,
    'PYG': 0,
    'RWF': 0,
    'TND': 3,
    'UGX': 0,
    'VND': 0,
    'VUV': 0,
    'XAF': 0,
    'XOF': 0,
    'XPF': 0,
}

_logger = logging.getLogger(__name__)


class PaymentAcquirer(models.Model):

    _inherit = 'payment.acquirer'

    provider = fields.Selection(
        selection_add=[('adyen', "Adyen")], ondelete={'adyen': 'set default'}
    )
    # TODO check if we can remove the public read access on payment.acquirer
    #  and then groups='base.group_user' -> yes, change access for public in access for accounting+website group
    adyen_merchant_account = fields.Char(
        string="Merchant Account",
        help="The code of the merchant account to use with this acquirer",
        required_if_provider='adyen', groups='base.group_system')
    adyen_api_key = fields.Char(
        string="API Key", help="The API key of the user account", required_if_provider='adyen',
        groups='base.group_system')
    adyen_checkout_api_url = fields.Char(
        string="Checkout API URL", help="The base URL for the Checkout API endpoints",
        required_if_provider='adyen', groups='base.group_system')
    adyen_recurring_api_url = fields.Char(
        string="Recurring API URL", help="The base URL for the Recurring API endpoints",
        required_if_provider='adyen', groups='base.group_system')

    #=== COMPUTE METHODS ===#

    @api.model
    def _get_supported_features(self, provider):
        """Get the specification of features supported by Adyen.

        :param string provider: The provider of the acquirer
        :return: The supported features for this acquirer
        :rtype: dict
        """
        if provider != 'adyen':
            return super()._get_supported_features(provider)

        return {'tokenization': True}

    #=== CRUD METHODS ===#

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            self._adyen_trim_api_urls(values)
        return super().create(values_list)

    def write(self, values):
        self._adyen_trim_api_urls(values)
        return super().write(values)

    @api.model
    def _adyen_trim_api_urls(self, values):
        """ Remove the version and the endpoint from the url of Adyen API fields.

        :param dict values: The create or write values
        :return: None
        """
        for field_name in ('adyen_checkout_api_url', 'adyen_recurring_api_url'):
            if field_name in values:
                field_value = values[field_name]
                values[field_name] = re.sub(r'[vV]\d+(/.*)?', '', field_value)

    #=== BUSINESS METHODS ===#
    
    @api.model
    # TODO make generic
    def _adyen_convert_to_minor_units(self, amount, currency_code):
        """ Return the amount converted to the minor units of the currency.

        For most currencies, this comes down to multiplying the amount by 100 to obtain the value in
        minor units. For some other currencies, the number of decimals ranges from 0 to 3. The
        conversion is then done by multiplying the amount by 10^k where k is the number of decimals.

        :param float amount: The amount to convert, rounded to 2 decimals
        :param string currency_code: The ISO 4217 currency code
        :return: The amount in minor units of the currency
        :rtype: int
        """
        k = CURRENCY_DECIMALS.get(currency_code, 2)
        return int(float_round(amount, k) * (10**k))

    def _adyen_compute_shopper_reference(self, partner_id):
        """ Compute a unique reference of the partner for Adyen.

        This is used for the `shopperReference` field in communications with Adyen and stored in the
        `adyen_shopper_reference` field on `payment.token` if the payment method is tokenized.

        :param recordset partner_id: The partner making the transaction, as a `res.partner` id
        :return: The unique reference for the partner
        :rtype: str
        """
        return f'ODOO_PARTNER_{partner_id}'

    def _adyen_make_request(self, base_url, endpoint_key, payload=None, method='POST'):
        """ Make a request to Adyen API at the specified endpoint.

        Note: self.ensure_one()

        :param str base_url: The base for the request URL. Depends on both the merchant and the API
        :param str endpoint_key: The identifier of the endpoint to be reached by the request
        :param dict payload: The payload of the request
        :param str method: The HTTP method of the request
        :return The JSON-formatted content of the response
        :rtype: dict
        :raise: ValidationError if an HTTP error occurs
        """

        def _build_url(_base_url, _version, _endpoint):
            """ Build an API URL by appending the version and endpoint to a base URL.

            The final URL follows this pattern : `<_base>/V<_version>/<_endpoint>`.

            :param str _base_url: The base of the url prefixed with `https://`
            :param int _version: The version of the endpoint
            :param str _endpoint: The endpoint of the URL.
            :return: The final URL
            :rtype: str
            """
            _base = _base_url.rstrip("/")  # Remove potential trailing slash
            _endpoint = _endpoint.lstrip("/")  # Remove potential leading slash
            return f'{_base}/V{_version}/{_endpoint}'

        self.ensure_one()

        version, endpoint = (API_ENDPOINTS[endpoint_key][k] for k in ('version', 'path'))
        url = _build_url(base_url, version, endpoint)
        headers = {'X-API-Key': self.adyen_api_key}
        response = requests.request(method, url, json=payload, headers=headers)
        if not response.ok:
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError:
                _logger.exception(response.text)
                # TODO try except in controller
                raise ValidationError(f"Adyen: {response.text}")
        return response.json()
