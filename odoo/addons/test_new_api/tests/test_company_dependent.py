# -*- coding: utf-8 -*-
import operator

from datetime import date, datetime

from odoo.exceptions import AccessError
from odoo.tests import common


class TestCompanyDependent(common.TransactionCase):
    def setUp(self):
        super().setUp()

        # assumption: users don't have access to 'ir.property'
        accesses = self.env['ir.model.access'].search([('model_id.model', '=', 'ir.property')])
        accesses.write(dict.fromkeys(['perm_read', 'perm_write', 'perm_create', 'perm_unlink'], False))

        # three test companies
        self.company0 = self.env.ref('base.main_company')
        self.company1, self.company2 = self.env['res.company'].create([{'name': 'A'}, {'name': 'B'}])
        # create one user per company
        self.user0, self.user1, self.user2 = self.env['res.users'].create([
            {'name': 'Foo', 'login': 'foo', 'company_id': self.company0.id, 'company_ids': []},
            {'name': 'Bar', 'login': 'bar', 'company_id': self.company1.id, 'company_ids': []},
            {'name': 'Baz', 'login': 'baz', 'company_id': self.company2.id, 'company_ids': []},
        ])
        # create values for many2one field
        self.tag0, self.tag1, self.tag2 = self.env['test_new_api.multi.tag'].create([
            {'name': 'Qux'},
            {'name': 'Quux'},
            {'name': 'Quuz'},
        ])

    def test_company_dependent(self):
        """ test company-dependent fields. """

        # create default values (not associated to record *or* company) for
        # the company-dependent fields
        field_foo = self.env['ir.model.fields']._get('test_new_api.company', 'foo')
        self.env['ir.property'].create({'name': 'foo', 'fields_id': field_foo.id, 'value': 'default', 'type': 'char'})
        field_tag_id = self.env['ir.model.fields']._get('test_new_api.company', 'tag_id')
        self.env['ir.property'].create({'name': 'foo', 'fields_id': field_tag_id.id, 'value': (self.tag0), 'type': 'many2one'})

        # create/modify a record, and check the value for each user
        record = self.env['test_new_api.company'].create({
            'foo': 'main',
            'date': '1932-11-09',
            'moment': '1932-11-09 00:00:00',
            'tag_id': self.tag1.id,
        })
        record.invalidate_cache()

        get = operator.itemgetter('foo', 'date', 'moment', 'tag_id')
        self.assertEqual(
            get(record.sudo(self.user0)),
            ('main', date(1932,11,9), datetime(1932,11,9), self.tag1)
        )
        self.assertEqual(
            get(record.sudo(self.user1)),
            ('default', False, False, self.tag0)
        )
        self.assertEqual(
            get(record.sudo(self.user2)),
            ('default', False, False, self.tag0)
        )

        record.sudo(self.user1).write({
            'foo': 'alpha',
            'date': '1932-12-10',
            'moment': '1932-12-10 23:59:59',
            'tag_id': self.tag2.id,
        })
        record.sudo(self.user2).tag_id = self.tag2
        record.invalidate_cache()
        self.assertEqual(
            get(record.sudo(self.user0)),
            ('main', date(1932,11,9), datetime(1932,11,9), self.tag1)
        )
        self.assertEqual(
            get(record.sudo(self.user1)),
            ('alpha', date(1932,12,10), datetime(1932,12,10,23,59,59), self.tag2)
        )
        self.assertEqual(
            get(record.sudo(self.user2)),
            ('default', False, False, self.tag2)
        )

        # unset value of a m2o and check again
        record.sudo(self.user2).tag_id = False
        # unlink value of a many2one and check again
        self.tag2.unlink()
        record.invalidate_cache()
        self.assertEqual(record.sudo(self.user0).tag_id, self.tag1)
        self.assertEqual(
            record.sudo(self.user1).tag_id, self.tag0.browse(),
            "deleting linked record (m2o) sets to false (doesn't unset)"
        )
        self.assertEqual(
            record.sudo(self.user2).tag_id, self.tag0.browse(),
            "setting to false doesn't unset either"
        )

        record.sudo(self.user1).foo = False
        record.invalidate_cache()
        self.assertEqual(record.sudo(self.user0).foo, 'main')
        self.assertEqual(record.sudo(self.user1).foo, False)
        self.assertEqual(record.sudo(self.user2).foo, 'default')

        # set field with 'force_company' in context
        record.sudo(self.user0).with_context(force_company=self.company1.id).foo = 'beta'
        record.invalidate_cache()
        self.assertEqual(record.sudo(self.user0).foo, 'main')
        self.assertEqual(record.sudo(self.user1).foo, 'beta')
        self.assertEqual(record.sudo(self.user2).foo, 'default')

    def test_access(self):
        # create/modify a record, and check the value for each user
        record = self.env['test_new_api.company'].create({})

        # add group on company-dependent field
        self.assertFalse(self.user0.has_group('base.group_system'))
        self.patch(type(record).foo, 'groups', 'base.group_system')
        with self.assertRaises(AccessError):
            record.sudo(self.user0).foo = 'forbidden'

        self.user0.write({'groups_id': [(4, self.env.ref('base.group_system').id)]})
        record.sudo(self.user0).foo = 'yes we can'

        # add ir.rule to prevent access on record
        self.assertTrue(self.user0.has_group('base.group_user'))
        self.env['ir.rule'].create({
            'model_id': self.env['ir.model']._get_id(record._name),
            'groups': [self.env.ref('base.group_user').id],
            'domain_force': str([('id', '!=', record.id)]),
        })
        with self.assertRaises(AccessError):
            record.sudo(self.user0).foo = 'forbidden'

    def test_compute(self):
        # create company record and attribute
        company_record = self.env['test_new_api.company'].create({'foo': 'ABC'})
        attribute_record = self.env['test_new_api.company.attr'].create({
            'company': company_record.id,
            'quantity': 1,
        })
        self.assertEqual(attribute_record.bar, 'ABC')
        # change quantity, 'bar' should recompute to 'ABCABC'
        attribute_record.quantity = 2
        self.assertEqual(attribute_record.bar, 'ABCABC')
        self.assertFalse(self.env.has_todo())
        # change company field 'foo', 'bar' should recompute to 'DEFDEF'
        company_record.foo = 'DEF'
        self.assertEqual(attribute_record.company.foo, 'DEF')
        self.assertEqual(attribute_record.bar, 'DEFDEF')
        self.assertFalse(self.env.has_todo())
