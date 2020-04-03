# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime

from odoo import api, exceptions, fields, models, _
from odoo.tools.safe_eval import safe_eval


class Team(models.Model):
    _inherit = 'crm.team.member'

    # assignment
    assignment_domain = fields.Char('Domain', tracking=True)
    assignment_max = fields.Integer('Leads Per Month')
    lead_month_count = fields.Integer(
        'Assigned Leads', compute='_compute_lead_month_count',
        help='Lead assigned to this member those last 30 days')

    def _compute_lead_month_count(self):
        for member in self:
            if member.id:
                limit_date = fields.Datetime.now() - datetime.timedelta(days=30)
                domain = [('user_id', '=', member.user_id.id),
                          ('team_id', '=', member.crm_team_id.id),
                          ('date_open', '>', limit_date)]
                member.lead_month_count = self.env['crm.lead'].search_count(domain)
            else:
                member.lead_month_count = 0

    @api.constrains('assignment_domain')
    def _assert_valid_domain(self):
        for member in self:
            try:
                domain = safe_eval(member.assignment_domain or '[]')
                self.env['crm.lead'].search(domain, limit=1)
            except Exception:
                raise exceptions.UserError(_('The domain is incorrectly formatted'))
