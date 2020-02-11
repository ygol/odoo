# -*- coding: utf-8 -*-
{
    'name': "Odoo referral program",

    'summary': """
        Allow you to refer your friends to Odoo and get rewards""",

    'category': 'Hidden',
    'version': '0.1',
    'depends': ['base', 'web'],
    'data': [
        'views/templates.xml',
    ],
    'qweb': [
        "static/src/xml/systray.xml",
    ],
    'auto_install': True,
}
