# -*- coding: utf-8 -*-

import json
import logging

from . import models
from odoo import api, SUPERUSER_ID, tools, _

_logger = logging.getLogger(__name__)


def enrich_base_company(cr, registry):
    env = api.Environment(cr, SUPERUSER_ID, {})
    if not env.company.email:
        return
    normalized_email = tools.email_normalize(env.company.email)
    if normalized_email:
        company_domain = normalized_email.split('@')[1]
        company_data = env['res.partner'].enrich_company(company_domain, False, env.company.vat)
        if company_data.get('error'):
            _logger.info("Base Company enrichement failed: %s" % company_data.get('error_message', _('Unkown reason')))
            return

        additional_data = company_data.pop('additional_info', False)

        if company_data.get('state_id'):
            company_data['state_id'] = company_data.get('state_id', {}).get('id', False)
        if company_data.get('country_id'):
            company_data['country_id'] = company_data.get('country_id', {}).get('id', False)

        # Keep only not null value and value not already set on the target partner.
        company_data = {field: value for field, value in company_data.items()
                        if field in env.company.partner_id._fields and value and not env.company.partner_id[field]}

        env.company.partner_id.write(company_data)
        if additional_data:
            template_values = json.loads(additional_data)
            template_values['flavor_text'] = _("Partner created by Odoo Partner Autocomplete Service")
            env.company.partner_id.message_post_with_view(
                'iap_mail.enrich_company',
                values=template_values,
                subtype_id=env.ref('mail.mt_note').id,
            )
