# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models


class ResCompany(models.Model):
    """ Add automatic assignment options on company. Sales team belonging to
    a company follow the company's rules. Other have no automatic assignment. """
    _inherit = 'res.company'

    crm_auto_assignment_interval = fields.Selection(
        [('manual', 'Manually'), ('daily', 'Daily'),
         ('weekly', 'Weekly'), ('monthly', 'Monthly')
        ], default='manual', string='Interval Unit')
    crm_auto_assignment_run_date = fields.Date(
        string="Next Execution Date", compute='_compute_crm_auto_assignment_run_date',
        readonly=False, store=True)

    @api.depends('crm_auto_assignment_interval')
    def _compute_crm_auto_assignment_run_date(self):
        for company in self:
            print('_compute_crm_auto_assignment_run_date', company, company.crm_auto_assignment_run_date)
            if not company.crm_auto_assignment_run_date or company.crm_auto_assignment_interval in (False, 'manual'):
                company.crm_auto_assignment_run_date = False
            if company.crm_auto_assignment_interval == 'daily':
                td = relativedelta(days=1)
            elif company.crm_auto_assignment_interval == 'weekly':
                td = relativedelta(weeks=1)
            else:
                td = relativedelta(months=1)
            company.crm_auto_assignment_run_date = fields.Date.today() + td
