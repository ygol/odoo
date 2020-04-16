# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'PEPPOL support for Accounting',
    'version': '1.0',
    'category': 'Accounting/Accounting',
    'depends': ['account_edi'],
    'data': [
        'data/account_edi_data.xml',
        'data/peppol_ubl_templates.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': True,
}
