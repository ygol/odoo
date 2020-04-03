# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'eCommerce',
    'category': 'Website/Website',
    'sequence': 55,
    'summary': 'Sell your products online',
    'website': 'https://www.odoo.com/page/e-commerce',
    'version': '1.1',
    'description': "",
    'depends': ['website', 'sale', 'website_payment', 'website_mail', 'website_form', 'portal_rating', 'digest'],
    'data': [
        'security/ir.model.access.csv',
        'security/website_sale.xml',
        'data/data.xml',
        'data/mail_template_data.xml',
        'data/digest_data.xml',
        'views/product_views.xml',
        'views/account_views.xml',
        'views/onboarding_views.xml',
        'views/sale_report_views.xml',
        'views/sale_order_views.xml',
        'views/crm_team_views.xml',
        'views/templates.xml',
        'views/snippets.xml',
        'views/snippets/s_products_searchbar.xml',
        'views/res_config_settings_views.xml',
        'views/digest_views.xml',
        'views/website_sale_visitor_views.xml',
    ],
    'demo': [
        'data/demo.xml',
    ],
    'qweb': ['static/src/xml/*.xml'],
    'installable': True,
    'application': True,
    'uninstall_hook': 'uninstall_hook',
}
