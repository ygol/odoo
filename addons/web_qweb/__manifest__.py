# -*- coding: utf-8 -*-
{
    'name': "Odoo Web QWeb View",
    'category': 'Hidden',
    'version': '1.0',
    # FIXME: find something other than partner for demo
    'depends': ['web', 'contacts'],
    'data': [
        'views/templates.xml',
    ],
    'demo': [
        'demo/partner.xml',
    ],
    'auto_install': True,
}
