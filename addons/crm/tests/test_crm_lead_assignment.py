# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.crm.tests.common import TestLeadConvertCommon
from odoo.tests.common import tagged, users


@tagged('lead_assign')
class TestLeadAssign(TestLeadConvertCommon):
    """ Test lead assignment feature added in saas-13.5. """

    @classmethod
    def setUpClass(cls):
        super(TestLeadAssign, cls).setUpClass()

        # don't mess with existing teams, deactivate them to make tests repeatable
        cls.sales_teams = cls.sales_team_1 + cls.sales_team_convert
        cls.env['crm.team'].search([('id', 'not in', cls.sales_teams.ids)]).write({'active': False})

        # don't mess with existing leads, deactivate those assigned to users used here to make tests repeatable
        cls.env['crm.lead'].search([('user_id', 'in', cls.sales_teams.member_ids.ids)]).write({'active': False})
        cls.bundle_size = 3
        cls.env['ir.config_parameter'].set_param('crm.assignment.bundle', '%s' % cls.bundle_size)

    def assertInitialData(self):
        self.assertEqual(self.sales_team_1.assignment_max, 60)
        self.assertEqual(self.sales_team_convert.assignment_max, 30)
        self.assertEqual(self.sales_team_1_m1.lead_month_count, 0)
        self.assertEqual(self.sales_team_1_m2.lead_month_count, 0)
        self.assertEqual(self.sales_team_convert_m1.lead_month_count, 0)

    @users('user_sales_manager')
    def test_crm_team_assign_duplicates(self):
        leads = self._create_leads_batch(lead_type='lead', user_ids=[False], count=10)
        self.assertInitialData()

        leads = self.env['crm.lead'].browse(leads.ids)
        self.env['crm.team'].cron_assign_leads()

        self.sales_teams.crm_team_member_ids.invalidate_cache()
        # TDE CLEANME: as there is some random, probably summing is the only way of doing an high level test
        self.assertEqual(
            sum((self.sales_team_1_m1 | self.sales_team_1_m2 | self.sales_team_convert_m1).mapped('lead_month_count')),
            5)  # 3 duplicates for partner1, 2 duplicates for partner2
        new_assigned_leads_wpartner = self.env['crm.lead'].search([
            ('partner_id', 'in', (self.contact_1 | self.contact_2).ids),
            ('user_id', 'in', self.sales_teams.member_ids.ids)
        ])
        self.assertEqual(len(new_assigned_leads_wpartner), 2)

    @users('user_sales_manager')
    def test_crm_team_assign_no_duplicates(self):
        leads = self._create_leads_batch(lead_type='lead', user_ids=[False], partner_ids=[False], count=10)
        self.assertInitialData()

        leads = self.env['crm.lead'].browse(leads.ids)
        self.env['crm.team'].cron_assign_leads()

        self.sales_teams.crm_team_member_ids.invalidate_cache()
        self.assertEqual(self.sales_team_1_m1.lead_month_count, 3)  # 45 max on 15
        self.assertEqual(self.sales_team_1_m2.lead_month_count, 1)  # 15 max on 15
        self.assertEqual(self.sales_team_convert_m1.lead_month_count, 2)  # 30 max on 15
