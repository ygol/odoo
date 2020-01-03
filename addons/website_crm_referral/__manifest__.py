# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name': 'Customer Referral',
    'category': 'Website/Website',
    'summary': 'Generate and follow-up referral for customers',
    'version': '1.0',
    'description': """
Help the company to get more leads by leveraging his existing customers' base. Main objective: everyone can refer a prospect. If the prospect subscribes, the referrer is rewarded.""",
    'depends': ['crm', 'website', 'link_tracker', 'mail'],
    'data': [
        'security/referral_security.xml',
        'security/ir.model.access.csv',
        'data/website_crm_referral_data.xml',
        'views/referral_menu.xml',
        'views/referral_views.xml',
        'views/referral_template.xml',
        'views/crm_lead_views.xml',
    ],
    'application': True,
}
