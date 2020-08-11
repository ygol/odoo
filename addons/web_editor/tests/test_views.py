# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import TransactionCase


class TestViews(TransactionCase):
    def test_infinite_inherit_loop(self):
        # Creates an infinite loop: A t-call B and A inherit from B
        View = self.env['ir.ui.view']
        first_view = View.create({
            'name': 'Test View 1',
            'type': 'qweb',
            'arch': '<div>Hello World</div>',
            'key': 'web_editor.test_first_view',
        })
        second_view = View.create({
            'name': 'Test View 2',
            'type': 'qweb',
            'arch': '<div><t t-call="web_editor.test_first_view"/></div>',
            'key': 'web_editor.test_second_view',
        })
        second_view.write({
            'inherit_id': first_view.id,
        })
        # Test for RecursionError: maximum recursion depth exceeded in this function
        View._views_get(first_view)

        third_view = View.create({
            'name': 'Test View 3',
            'type': 'qweb',
            'arch': '''<xpath expr='//t[@t-call="web_editor.test_first_view"]' position='after'>
                    <div class="oe_structure" id='oe_structure_test_view_3'/></xpath>''',
            'key': 'web_editor.test_third_view',
            'inherit_id': second_view.id
        })
        # check view mode
        self.assertEqual(third_view.mode, 'extension')

        # update content of the oe_structure
        value = '''<div class="oe_structure" id="oe_structure_test_view_3" data-oe-id="%s"
             data-oe-xpath="/xpath/div" data-oe-model="ir.ui.view" data-oe-field="arch">
            <div>Please contact to JPR for more details of this product!</div></div>''' % third_view.id

        third_view.save(value=value, xpath='/xpath/div')

        self.assertEqual(len(third_view.inherit_children_ids), 1)
        self.assertEqual(third_view.inherit_children_ids.mode, 'extension')
        self.assertIn('<div>Please contact to JPR for more details of this product!</div>',
            third_view.inherit_children_ids.read_combined(['arch'])['arch'],
        )
