# -*- coding: utf-8 -*-
{
    'name': "Odoo referral program bridge with portal",

    'summary': """
        Allow you to refer your friends to Odoo and get rewards""",

    'category': 'Hidden',
    'version': '0.1',
    'depends': ['website', 'odoo_referral'],
    'data': [
        'views/referral_template.xml',
    ],
    'auto_install': True,
}
