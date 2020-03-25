# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'Email Marketing',
    'summary': 'Design, send and track emails',
    'description': "",
    'version': '2.3',
    'sequence': 110,
    'website': 'https://www.odoo.com/page/mailing',
    'category': 'Marketing/Email Marketing',
    'depends': [
        'contacts',
        'mail',
        'utm',
        'link_tracker',
        'web_editor',
        'web_kanban_gauge',
        'social_media',
        'web_tour',
        'digest',
    ],
    'data': [
        'security/mass_mailing_security.xml',
        'security/ir.model.access.csv',
        'data/mail_data.xml',
        'data/mailing_data_templates.xml',
        'data/mass_mailing_data.xml',
        'wizard/mail_compose_message_views.xml',
        'wizard/mailing_list_merge_views.xml',
        'wizard/mailing_mailing_test_views.xml',
        'views/mailing_mailing_views_menus.xml',
        'views/mailing_trace_views.xml',
        'views/link_tracker_views.xml',
        'views/mailing_contact_views.xml',
        'views/mailing_list_views.xml',
        'views/mailing_mailing_views.xml',
        'views/res_config_settings_views.xml',
        'views/utm_campaign_views.xml',
        'report/mailing_trace_report_views.xml',
        'views/assets.xml',
        'views/mass_mailing_templates_portal.xml',
        'views/themes_templates.xml',
        'views/snippets_themes.xml',
    ],
    'demo': [
        'data/mass_mailing_demo.xml',
    ],
    'qweb': [
        'static/src/xml/*.xml',
    ],
    'application': True,
}
