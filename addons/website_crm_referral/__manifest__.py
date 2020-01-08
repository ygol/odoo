# -*- coding: utf-8 -*-
{
    'name': "Bridge module for website_sale_referral and crm",

    'summary': """
        Bridge module for website_sale_referral and crm""",

    'description': """
        Allows to create lead when a referral is made
    """,
    'category': 'Website/Website',
    'version': '0.1',
    'depends': ['website_sale_referral', 'crm'],
    'data': [
        'views/res_config_settings_views.xml',
        'views/referral_template.xml',
    ],
    'auto_install': True,
}
