# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import psycopg2

from odoo import exceptions
from odoo.addons.sales_team.tests.common import TestSalesMC
from odoo.tests.common import users



class TestCornerCases(TestSalesMC):

    @users('user_sales_manager')
    def test_unicity(self):
        """ Even archived memberships raise the unicity constraint """
        membership = self.sales_team_1_m1.with_user(self.env.user)
        membership.write({'active': False})
        membership.flush()

        with self.assertRaises(psycopg2.IntegrityError):
            self.env['crm.team.member'].create({
                'user_id': self.user_sales_leads.id,
                'crm_team_id': self.sales_team_1.id,
            })


class TestSecurity(TestSalesMC):

    @users('user_sales_leads')
    def test_access(self):
        sales_team = self.sales_team_1.with_user(self.env.user)

        sales_team.read(['name'])
        for member in sales_team.member_ids:
            member.read(['name'])

        with self.assertRaises(exceptions.AccessError):
            sales_team.write({'name': 'Trolling'})

        for membership in sales_team.crm_team_member_ids:
            membership.read(['name'])
            with self.assertRaises(exceptions.AccessError):
                membership.write({'active': False})

        with self.assertRaises(exceptions.AccessError):
            sales_team.write({'member_ids': [(5, 0)]})

    @users('user_sales_manager')
    def test_multi_company(self):
        self.sales_team_1.with_user(self.env.user).read(['name'])
        with self.assertRaises(exceptions.AccessError):
            self.team_c2.with_user(self.env.user).read(['name'])
