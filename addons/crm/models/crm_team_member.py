# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
import math
import threading
import random

from ast import literal_eval

from odoo import api, exceptions, fields, models, _
from odoo.tools.safe_eval import safe_eval
from odoo.osv import expression


class Team(models.Model):
    _inherit = 'crm.team.member'

    # assignment
    assignment_domain = fields.Char('Domain', tracking=True)
    assignment_max = fields.Integer('Leads / 30 Days')
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

    # ------------------------------------------------------------
    # LEAD ASSIGNMENT
    # ------------------------------------------------------------

    def _assign_and_convert_leads(self):
        members = self.filtered(lambda member: member.assignment_max > member.lead_month_count)
        if not members:
            return

        members_data, population, weights = dict(), list(), list()
        lead_limit = sum(
            # assignment_max count for 30 days -> assign for the next 2 days
            min(int(math.ceil(member.assignment_max / 15.0)), (member.assignment_max - member.lead_month_count))
            for member in members
        )

        # optimize a bit: you may have users without domain -> batchize them
        for member in members:
            lead_domain = expression.AND([
                literal_eval(member.assignment_domain or '[]'),
                ['&', ('user_id', '=', False), ('date_open', '=', False)]
            ])
            leads = self.env["crm.lead"].search(lead_domain, order='probability DESC', limit=lead_limit)
            to_assign = min(member.assignment_max - member.lead_month_count, int(math.ceil(member.assignment_max / 15.0)))
            members_data[member.id] = {
                "team_member": member,
                "to_assign": to_assign,
                "leads": leads
            }
            population.append(member.id)
            weights.append(to_assign)
        leads_done_ids = set()
        counter = 0
        while population and counter < 10:
            counter += 1
            member_id = random.choices(population, weights=weights, k=1)[0]
            member_index = population.index(member_id)
            member_data = members_data[member_id]

            lead = next((lead for lead in member_data['leads'] if lead.id not in leads_done_ids), False)
            if lead:
                leads_done_ids.add(lead.id)
                weights[member_index] = weights[member_index] - 1
                lead.with_context(mail_auto_subscribe_no_notify=True).convert_opportunity(
                    lead.partner_id.id,
                    user_ids=member_data['team_member'].user_id.ids
                )

                # auto-commit except in testing mode
                auto_commit = not getattr(threading.currentThread(), 'testing', False)
                if auto_commit:
                    self._cr.commit()
            else:
                weights[member_index] = 0

            if weights[member_index] <= 0:
                population.pop(member_index)
                weights.pop(member_index)
