# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.exceptions import UserError
from odoo import fields

from odoo.tests import tagged


@tagged('post_install', '-at_install')
class TestAccountMove(AccountTestInvoicingCommon):

    def test_account_move_count(self):
        self.env['account.move'].create([
            {
                'move_type': 'out_invoice',
                'date': '2017-01-01',
                'invoice_date': '2017-01-01',
                'partner_id': self.partner_a.id,
                'invoice_line_ids': [(0, 0, {'name': 'aaaa', 'price_unit': 100.0})],
            },
            {
                'move_type': 'in_invoice',
                'date': '2017-01-01',
                'invoice_date': '2017-01-01',
                'partner_id': self.partner_a.id,
                'invoice_line_ids': [(0, 0, {'name': 'aaaa', 'price_unit': 100.0})],
            },
        ]).post()

        self.assertEqual(self.partner_a.supplier_rank, 1)
        self.assertEqual(self.partner_a.customer_rank, 1)

    def test_account_move_inactive_currency_raise_error_on_post(self):
        """ Ensure a move cannot be posted when using an inactive currency """
        move = self.env['account.move'].create({
            'move_type': 'in_invoice',
            'partner_id': self.partner_a.id,
            'invoice_date': fields.Date.from_string('2019-01-01'),
            'currency_id': self.currency_data['currency'].id,
            'invoice_payment_term_id': self.pay_terms_a.id,
            'invoice_line_ids': [{}]
        })

        move.currency_id.active = False

        with self.assertRaises(UserError):
            move.post()

        # Make sure that the invoice can still be posted when the currency is active
        move.currency_id.active = True
        move.post()

        self.assertEqual(move.state, 'posted')
