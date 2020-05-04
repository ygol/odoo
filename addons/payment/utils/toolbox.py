# Part of Odoo. See LICENSE file for full copyright and licensing details.
# TODO ANV move to payment/utils.py

import hashlib
import hmac

from odoo.tools import consteq, ustr


def generate_access_token(secret, *values):
    """ Generate an access token based on the provided values.

    The token allows to later verify the validity of a request to this controller, based on a
    given set of values. These will generally include the partner id, amount, currency id,
    transaction id or transaction reference. All values must be convertible to a string.

    :param str secret: The secret string to use to sign the token
    :param list values: The values to use for the generation of the token
    :return: The generated access token
    :rtype: str
    """
    token_str = ''.join(str(val) for val in values)
    access_token = hmac.new(
        secret.encode('utf-8'), token_str.encode('utf-8'), hashlib.sha256
    ).hexdigest()
    return access_token

def check_access_token(access_token, secret, *values):
    """ Check the validity of the access token for the provided values.

    The values must be provided in the exact same order as they were to `generate_access_token`.
    All values must be convertible to a string.

    :param str access_token: The access token used to verify the provided values
    :param str secret: The secret string used to sign the token
    :param list values: The values to verify against the token
    :return: True if the check is successful
    :rtype: bool
    """
    authentic_token = generate_access_token(secret, *values)
    return access_token and consteq(ustr(access_token), authentic_token)
