from odoo.tests import common
from odoo import fields
from odoo.exceptions import ValidationError

TEST_CASES = [
    {
        # no values
    }, {
        'basic': 'value',
    }, {
        'default': 'value',
    }, {
        'basic': 'value',
        'default': 'value',
    }
]

COMPUTED_VALUE= {
    'default': 'compute',
    'basic': 'basic',
}

DEFAULT_VALUE = {
    'default': 'default',
    'basic': False,
}

@common.tagged('prepostcomputes')
class TestPrePostComputes(common.TransactionCase):

    def test_pre_post_create_computes(self):
        Model = self.env["test_new_api.model_advanced_computes"]

        # Check automatic assignation of pre_compute=False on pre_compute=True fields
        # 1) dependency on create_date/create_uid/write_date/write_uid
        self.assertFalse(Model._fields.get('create_month').pre_compute)

        # Force computation on a new and assertRaises Error
        new_record = Model.new({
            'name1': 'Nathan',
            'name2': 'Algren',
            'title': 'Military Advisor',
        })
        with self.assertRaises(ValidationError):
            new_record.duplicates
        # Create two records and check duplicates are correctly assigned
        # If they were computed pre_create, duplicates fields would be empty.
        # Context key ensure the computes are all called during the create call.
        records = Model.with_context(creation=True).create([
            {
                'name1': 'Hans',
                'name2': 'zimmer',
                'title': 'Musical Composer'
            }, {
                'name1': 'hans',
                'name2': 'Zimmer',
                'title': 'Artist'
            }
        ])
        self.assertEqual(len(records), 2)
        self.assertEqual(records.duplicates, records)
        self.assertEqual(records[0].duplicates, records[1])
        self.assertEqual(records[1].duplicates, records[0])

        self.assertEqual(records[0].full_upper_name, records[1].full_upper_name)
        self.assertTrue(records[0].create_month)
        self.assertTrue(records[1].create_month)

    def test_x2m_precomputation(self):
        Model = self.env["test_new_api.model_advanced_computes"]
        recs = Model.with_context(creation=True).create([
            {
                'name1': 'Hans',
                'name2': 'zimmer',
                'title': 'Musical Composer',
                'child_ids': [(0,0,dict()), (0,0,dict())],
                'related_ids': [(0,0,dict()), (0,0,dict()), (0,0,dict()), (0,0,dict())]
            }, {
                'name1': 'hans',
                'name2': 'Zimmer',
                'title': 'Artist',
                'child_ids': [(0,0,dict())],
                'related_ids': [(0,0,dict()), (0,0,dict()), (0,0,dict())]
            }
        ])
        self.assertEqual(recs[0].related_value, 20.0)
        self.assertEqual(recs[0].children_value, 10.0)
        for display_info in recs[0].child_ids.mapped("display_info"):
            self.assertEqual(display_info, "Musical Composer\nBlabla")
        for display_info in recs[0].related_ids.mapped("display_info"):
            self.assertEqual(display_info, "\nBlabla")

    def test_basic_model(self):
        """One INSERT expected by create"""
        model = 'test_new_api.dummy'
        # Dummy create to fill ir_default orm_cache
        self.env[model].create(TEST_CASES)
        for test_case in TEST_CASES:
            with self.assertQueryCount(1):
                record = self.env[model].create(test_case)
                self.env[model].flush()
                for field in ['basic', 'default']:
                    self.assertEqual(
                        record[field],
                        test_case.get(
                            field,
                            DEFAULT_VALUE[field],
                        ),
                    )

        with self.assertQueryCount(len(TEST_CASES)):
            self.env[model].create(TEST_CASES)
            self.env[model].flush()

    def test_compute_readonly(self):
        model = 'test_new_api.dummy.compute'
        # Dummy create to fill ir_default orm_cache
        self.env[model].create(TEST_CASES)
        for test_case in TEST_CASES:
            with self.assertQueryCount(1):
                record = self.env[model].create(test_case)
                self.env[model].flush()
                for field in ['basic', 'default']:
                    self.assertEqual(
                        record[field],
                        COMPUTED_VALUE[field],
                    )
            # VFE TODO ensure values are the default computed ones

        with self.assertQueryCount(len(TEST_CASES)):
            self.env[model].create(TEST_CASES)
            self.env[model].flush()

    def test_compute_editable(self):
        model = 'test_new_api.dummy.compute.editable'
        # Dummy create to fill ir_default orm_cache
        self.env[model].create(TEST_CASES)
        for test_case in TEST_CASES:
            with self.assertQueryCount(1):
                record = self.env[model].create(test_case)
                self.env[model].flush()
                for field in ['basic', 'default']:
                    self.assertEqual(
                        record[field],
                        test_case.get(
                            field,
                            DEFAULT_VALUE.get(field) if field == 'default' else COMPUTED_VALUE[field]
                        ),
                    )

        with self.assertQueryCount(len(TEST_CASES)):
            self.env[model].create(TEST_CASES)
            self.env[model].flush()

    def test_compute_inverse(self):
        model = 'test_new_api.dummy.compute.inverse'
        # Dummy create to fill ir_default orm_cache
        self.env[model].create(TEST_CASES)
        for test_case in TEST_CASES:
            with self.assertQueryCount(2 + (1 if 'basic' not in test_case else 0)):
                # 1 Insert + 1 Update (for at least default_inversed)
                # + 1 select if basic not defined ??? --> to get basic value from db?
                record = self.env[model].create(test_case)
                self.env[model].flush()
                self.assertEqual(
                    'basic' in test_case,
                    record.basic_inversed,
                )
                # default field inverse should always have been triggered
                # Either by the value given to create or by the value given by the field default
                self.assertTrue(record.default_inversed)
                for field in ['basic', 'default']:
                    self.assertEqual(
                        record[field],
                        test_case.get(
                            field,
                            DEFAULT_VALUE.get(field) if field == 'default' else COMPUTED_VALUE[field]
                        ),
                    )

        # 5 INSERT + 2 Update (default_inverse - default_inversed,basic_inversed)
        with self.assertQueryCount(len(TEST_CASES) + 2):
            self.env[model].create(TEST_CASES)
            self.env[model].flush()
