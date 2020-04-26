# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Google Gmail',
    'version': '0.1',
    'sequence': 165,
    'category': 'Mail',
    'description': "GMAIL support for incoming/outgoing mail servers",
    'depends': [
        'google_account',
    ],
    'data': [
        'data/res_config_settings.xml',
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'auto_install': True,
}
