# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
import logging
import threading

from ast import literal_eval

from odoo import api, exceptions, fields, models, _
from odoo.osv import expression
from odoo.tools import safe_eval

_logger = logging.getLogger(__name__)


class Team(models.Model):
    _name = 'crm.team'
    _inherit = ['mail.alias.mixin', 'crm.team']
    _description = 'Sales Team'

    use_leads = fields.Boolean('Leads', help="Check this box to filter and qualify incoming requests as leads before converting them into opportunities and assigning them to a salesperson.")
    use_opportunities = fields.Boolean('Pipeline', default=True, help="Check this box to manage a presales process with opportunities.")
    alias_id = fields.Many2one(
        'mail.alias', string='Alias', ondelete="restrict", required=True,
        help="The email address associated with this channel. New emails received will automatically create new leads assigned to the channel.")
    # assignment
    assignment_enabled = fields.Boolean('Auto Assignment', compute='_compute_assignment_enabled')
    assignment_optout = fields.Boolean('Do not auto assign')
    assignment_max = fields.Integer(
        'Lead Capacity', compute='_compute_assignment_max',
        help='Monthly leads for all salesmen belonging to the team')
    assignment_domain = fields.Char('Domain', tracking=True)
    assignment_interval = fields.Selection(
        string="Assignment Frequency", related='company_id.crm_auto_assignment_interval',
        readonly=True)
    # statistics about leads / opportunities / both
    lead_unassigned_count = fields.Integer(
        string='# Unassigned Leads', compute='_compute_lead_unassigned_count')
    lead_all_assigned_month_count = fields.Integer(
        string='# Leads/Opps assigned this month', compute='_compute_lead_all_assigned_month_count',
        help="Number of leads and opportunities assigned this last month.")
    opportunities_count = fields.Integer(
        string='# Opportunities', compute='_compute_opportunities_data')
    opportunities_amount = fields.Integer(
        string='Opportunities Revenues', compute='_compute_opportunities_data')
    opportunities_overdue_count = fields.Integer(
        string='# Overdue Opportunities', compute='_compute_opportunities_overdue_data')
    opportunities_overdue_amount = fields.Integer(
        string='Overdue Opportunities Revenues', compute='_compute_opportunities_overdue_data',)
    # alias: improve fields coming from _inherits, use inherited to avoid replacing them
    alias_user_id = fields.Many2one(
        'res.users', related='alias_id.alias_user_id', inherited=True,
        domain=lambda self: [('groups_id', 'in', self.env.ref('sales_team.group_sale_salesman_all_leads').id)])

    @api.depends('crm_team_member_ids.assignment_max')
    def _compute_assignment_max(self):
        for rec in self:
            rec.assignment_max = sum(s.assignment_max for s in rec.crm_team_member_ids)

    def _compute_assignment_enabled(self):
        assignment_enabled = self.env['ir.config_parameter'].sudo().get_param('crm.auto_assignment', False)
        for team in self:
            team.assignment_enabled = assignment_enabled

    def _compute_lead_unassigned_count(self):
        leads_data = self.env['crm.lead'].read_group([
            ('team_id', 'in', self.ids),
            ('type', '=', 'lead'),
            ('user_id', '=', False),
        ], ['team_id'], ['team_id'])
        counts = {datum['team_id'][0]: datum['team_id_count'] for datum in leads_data}
        for team in self:
            team.lead_unassigned_count = counts.get(team.id, 0)

    def _compute_lead_all_assigned_month_count(self):
        limit_date = datetime.datetime.now() - datetime.timedelta(days=30)
        leads_data = self.env['crm.lead'].read_group([
            ('team_id', 'in', self.ids),
            ('date_open', '>=', fields.Datetime.to_string(limit_date)),
            ('user_id', '!=', False),
        ], ['team_id'], ['team_id'])
        counts = {datum['team_id'][0]: datum['team_id_count'] for datum in leads_data}
        for team in self:
            team.lead_all_assigned_month_count = counts.get(team.id, 0)

    def _compute_opportunities_data(self):
        opportunity_data = self.env['crm.lead'].search([
            ('team_id', 'in', self.ids),
            ('probability', '<', 100),
            ('type', '=', 'opportunity'),
        ]).read(['planned_revenue', 'team_id'])
        counts = {}
        amounts = {}
        for datum in opportunity_data:
            counts.setdefault(datum['team_id'][0], 0)
            amounts.setdefault(datum['team_id'][0], 0)
            counts[datum['team_id'][0]] += 1
            amounts[datum['team_id'][0]] += (datum.get('planned_revenue', 0))
        for team in self:
            team.opportunities_count = counts.get(team.id, 0)
            team.opportunities_amount = amounts.get(team.id, 0)

    def _compute_opportunities_overdue_data(self):
        opportunity_data = self.env['crm.lead'].read_group([
            ('team_id', 'in', self.ids),
            ('probability', '<', 100),
            ('type', '=', 'opportunity'),
            ('date_deadline', '<', fields.Date.to_string(fields.Datetime.now()))
        ], ['planned_revenue', 'team_id'], ['team_id'])
        counts = {datum['team_id'][0]: datum['team_id_count'] for datum in opportunity_data}
        amounts = {datum['team_id'][0]: (datum['planned_revenue']) for datum in opportunity_data}
        for team in self:
            team.opportunities_overdue_count = counts.get(team.id, 0)
            team.opportunities_overdue_amount = amounts.get(team.id, 0)

    @api.onchange('use_leads', 'use_opportunities')
    def _onchange_use_leads_opportunities(self):
        if not self.use_leads and not self.use_opportunities:
            self.alias_name = False

    @api.constrains('assignment_domain')
    def _assert_assignment_domain(self):
        for team in self:
            if team.assignment_domain:
                try:
                    domain = literal_eval(team.assignment_domain)
                    self.env['crm.lead'].search_count(domain)
                except Exception:
                    raise Warning('Domain for %s is incorrectly formatted' % team.name)

    # ------------------------------------------------------------
    # ORM
    # ------------------------------------------------------------

    def write(self, vals):
        result = super(Team, self).write(vals)
        if 'use_leads' in vals or 'use_opportunities' in vals:
            self.filtered(lambda team: not team.use_leads and not team.use_opportunities).alias_name = False
        return result

    # ------------------------------------------------------------
    # MESSAGING
    # ------------------------------------------------------------

    def _alias_get_creation_values(self):
        values = super(Team, self)._alias_get_creation_values()
        values['alias_model_id'] = self.env['ir.model']._get('crm.lead').id
        if self.id:
            if not self.use_leads and not self.use_opportunities:
                values['alias_name'] = False
            values['alias_defaults'] = defaults = literal_eval(self.alias_defaults or "{}")
            has_group_use_lead = self.env.user.has_group('crm.group_use_lead')
            defaults['type'] = 'lead' if has_group_use_lead and self.use_leads else 'opportunity'
            defaults['team_id'] = self.id
        return values

    # ------------------------------------------------------------
    # LEAD ASSIGNMENT
    # ------------------------------------------------------------

    @api.model
    def cron_assign_leads(self):
        if not self.env.user.has_group('sales_team.group_sale_manager') and not self.env.user.has_group('base.group_system'):
            raise exceptions.UserError(_('Lead/Opportunities automatic assignment is limited to managers or administrators'))

        return self.env['crm.team'].search([]).action_assign_leads()

    def action_assign_leads(self):
        if not self.env.user.has_group('sales_team.group_sale_manager') and not self.env.user.has_group('base.group_system'):
            raise exceptions.UserError(_('Lead/Opportunities automatic assignment is limited to managers or administrators'))
        team_members = self.mapped('crm_team_member_ids')

        _logger.info('### START Lead Assignment (%d teams, %d sales persons)' % (len(self), len(team_members)))
        self._assign_leads_to_teams()
        team_members._assign_and_convert_leads()
        _logger.info('### END Lead Assignment')

    def _assign_leads_to_teams(self):
        BUNDLE_SIZE = int(self.env['ir.config_parameter'].sudo().get_param('crm.assignment.bundle', default=50))
        team_done = self.env['crm.team']
        # limit_date = fields.Datetime.now() - datetime.timedelta(hours=1)
        limit_date = fields.Datetime.now() + datetime.timedelta(hours=1)
        remaining_teams = self
        team_domains = dict()

        while remaining_teams:
            for team in remaining_teams:
                if team not in team_domains:
                    if not team.assignment_domain:
                        team_domains[team] = []
                    else:
                        team_domains[team] = literal_eval(team.assignment_domain)

                lead_domain = expression.AND([
                    team_domains[team],
                    [('create_date', '<', limit_date)],
                    ['&', ('team_id', '=', False), ('user_id', '=', False)],
                    ['|', ('stage_id.is_won', '=', False), ('probability', 'not in', [False, 0, 100])]
                ])
                leads = self.env["crm.lead"].search(lead_domain, limit=BUNDLE_SIZE)

                if len(leads) < BUNDLE_SIZE:
                    team_done += team

                leads_dup_ids = team._assign_and_deduplicate_leads(leads)

                _logger.info('Assigned %s leads to team %s' % (len(leads), team.id))
                _logger.info('Duplicated leads: %s' % leads_dup_ids)
                _logger.info('List of leads: %s' % leads)

                # auto-commit except in testing mode
                auto_commit = not getattr(threading.currentThread(), 'testing', False)
                if auto_commit:
                    self._cr.commit()

            remaining_teams = remaining_teams.browse([tid for tid in remaining_teams.ids if tid not in team_done.ids])

    def _assign_and_deduplicate_leads(self, leads):
        self.ensure_one()

        leads_done_ids = set()
        leads_dup_ids = set()
        for lead in leads:
            if lead.id not in leads_done_ids | leads_dup_ids:
                leads_duplicated = lead._get_lead_duplicates(email=lead.email_from)
                if len(leads_duplicated) > 1:
                    merged = leads_duplicated.merge_opportunity(user_id=False, team_id=self.id)
                    leads_dup_ids.update((leads_duplicated - merged).ids)
                else:
                    lead.handle_salesmen_assignment(team_id=self.id)
                leads_done_ids.add(lead.id)
            # auto-commit except in testing mode
            auto_commit = not getattr(threading.currentThread(), 'testing', False)
            if auto_commit:
                self._cr.commit()

        return leads_dup_ids

    # ------------------------------------------------------------
    # ACTIONS
    # ------------------------------------------------------------

    #TODO JEM : refactor this stuff with xml action, proper customization,
    @api.model
    def action_your_pipeline(self):
        action = self.env.ref('crm.crm_lead_action_pipeline').read()[0]
        user_team_id = self.env.user.sale_team_id.id
        if user_team_id:
            # To ensure that the team is readable in multi company
            user_team_id = self.search([('id', '=', user_team_id)], limit=1).id
        else:
            user_team_id = self.search([], limit=1).id
            action['help'] = _("""<p class='o_view_nocontent_smiling_face'>Add new opportunities</p><p>
    Looks like you are not a member of a Sales Team. You should add yourself
    as a member of one of the Sales Team.
</p>""")
            if user_team_id:
                action['help'] += "<p>As you don't belong to any Sales Team, Odoo opens the first one by default.</p>"

        action_context = safe_eval(action['context'], {'uid': self.env.uid})
        if user_team_id:
            action_context['default_team_id'] = user_team_id

        action['context'] = action_context
        return action

    def _compute_dashboard_button_name(self):
        super(Team, self)._compute_dashboard_button_name()
        team_with_pipelines = self.filtered(lambda el: el.use_opportunities)
        team_with_pipelines.update({'dashboard_button_name': _("Pipeline")})

    def action_primary_channel_button(self):
        if self.use_opportunities:
            return self.env.ref('crm.crm_case_form_view_salesteams_opportunity').read()[0]
        return super(Team,self).action_primary_channel_button()

    def _graph_get_model(self):
        if self.use_opportunities:
            return 'crm.lead'
        return super(Team,self)._graph_get_model()

    def _graph_date_column(self):
        if self.use_opportunities:
            return 'create_date'
        return super(Team,self)._graph_date_column()

    def _graph_y_query(self):
        if self.use_opportunities:
            return 'count(*)'
        return super(Team,self)._graph_y_query()

    def _extra_sql_conditions(self):
        if self.use_opportunities:
            return "AND type LIKE 'opportunity'"
        return super(Team,self)._extra_sql_conditions()

    def _graph_title_and_key(self):
        if self.use_opportunities:
            return ['', _('New Opportunities')] # no more title
        return super(Team, self)._graph_title_and_key()
