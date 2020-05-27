# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common

class test_inherit(common.TransactionCase):
    def test_ir_model_data_xmlid_two_ways_inheritance_with_mixin(self):
        """ Check the XMLID exists one the concrete model """

        # Test the situation where there is a mixin X defined in module A,
        # a model M defined in module B and that a third module C extends M
        # to depends on C. The XMLID for X on C must exist.
        # A => test_new_api (just because it is handy to reuse it)
        # B => test_inherit
        # C => test_inherit_depends
        # M => test_new_api.foo
        # X => test.inherit.mixin
        IrModelData = self.env['ir.model.data']
        field = IrModelData.search([('name', '=', 'field_test_new_api_bazz__published')])
        self.assertEqual(len(field), 1)
        self.assertEqual(field.module, 'test_inherit_depends')
