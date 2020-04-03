# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.sales_team.tests.common import TestSalesMC
from odoo.tests.common import users


class TestMembership(TestSalesMC):
    """Tests to ensure membership behavior """

    @users('user_sales_manager')
    def test_membership_sync(self):
        new_team = self.env['crm.team'].create({
            'name': 'Test Specific',
        })
        self.assertEqual(new_team.crm_team_member_ids, self.env['crm.team.member'])
        self.assertEqual(new_team.crm_team_member_all_ids, self.env['crm.team.member'])
        self.assertEqual(new_team.member_ids, self.env['res.users'])

        # creating memberships correctly updates m2m without any refresh
        new_member = self.env['crm.team.member'].create({
            'user_id': self.env.user.id,
            'crm_team_id': new_team.id,
        })
        self.assertEqual(new_team.crm_team_member_ids, new_member)
        self.assertEqual(new_team.crm_team_member_all_ids, new_member)
        self.assertEqual(new_team.member_ids, self.env.user)

        # adding members correctly update o2m with right values
        new_team.write({
            'member_ids': [(4, self.user_sales_leads.id)]
        })
        added = self.env['crm.team.member'].search([('crm_team_id', '=', new_team.id), ('user_id', '=', self.user_sales_leads.id)])
        self.assertEqual(new_team.crm_team_member_ids, new_member + added)
        self.assertEqual(new_team.crm_team_member_all_ids, new_member + added)
        self.assertEqual(new_team.member_ids, self.env.user | self.user_sales_leads)

        # archiving membership correctly updates m2m and o2m
        added.write({'active': False})
        self.assertEqual(new_team.crm_team_member_ids, new_member)
        self.assertEqual(new_team.crm_team_member_all_ids, new_member + added)
        self.assertEqual(new_team.member_ids, self.env.user)

        # reactivating correctly updates m2m and o2m
        added.write({'active': True})
        self.assertEqual(new_team.crm_team_member_ids, new_member + added)
        self.assertEqual(new_team.crm_team_member_all_ids, new_member + added)
        self.assertEqual(new_team.member_ids, self.env.user | self.user_sales_leads)

        # send to db as errors may pop at that step (like trying to set NULL on a m2o inverse of o2m)
        new_team.flush()


class TestDefaultTeam(TestSalesMC):
    """Tests to check if correct default team is found."""

    @classmethod
    def setUpClass(cls):
        """Set up data for default team tests."""
        super(TestDefaultTeam, cls).setUpClass()

        cls.team_sequence = cls.env['crm.team'].create({
            'name': 'Team LowSequence',
            'sequence': 0,
            'company_id': False,
        })
        cls.team_responsible = cls.env['crm.team'].create({
            'name': 'Team 3',
            'user_id': cls.user_sales_manager.id,
            'sequence': 3,
            'company_id': cls.company_main.id
        })

    def test_default_team_member(self):
        with self.with_user('user_sales_leads'):
            team = self.env['crm.team']._get_default_team_id()
            self.assertEqual(team, self.sales_team_1)

        # responsible with lower sequence better than member with higher sequence
        self.team_responsible.user_id = self.user_sales_leads.id
        with self.with_user('user_sales_leads'):
            team = self.env['crm.team']._get_default_team_id()
            self.assertEqual(team, self.team_responsible)

    def test_default_team_fallback(self):
        """ Test fallback: domain, order """
        self.sales_team_1.member_ids = [(5,)]
        self.sales_team_1.flush()

        with self.with_user('user_sales_leads'):
            team = self.env['crm.team']._get_default_team_id()
            self.assertEqual(team, self.team_sequence)

        # next one is team_responsible with sequence = 3 (team_c2 is in another company)
        self.team_sequence.active = False
        with self.with_user('user_sales_leads'):
            team = self.env['crm.team']._get_default_team_id()
            self.assertEqual(team, self.team_responsible)

        self.user_sales_leads.write({
            'company_ids': [(4, self.company_2.id)],
            'company_id': self.company_2.id,
        })
        # multi company: switch company
        self.user_sales_leads.write({'company_id': self.company_2.id})
        with self.with_user('user_sales_leads'):
            team = self.env['crm.team']._get_default_team_id()
            self.assertEqual(team, self.team_c2)
