# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class CrmTeamMember(models.Model):
    _name = 'crm.team.member'
    _inherit = ['mail.thread']
    _description = 'Sales Team Member'
    _rec_name = 'user_id'

    crm_team_id = fields.Many2one( 'crm.team', string='Sales Team', index=True, required=True)
    user_id = fields.Many2one(
        'res.users', string='Salesman',   # check responsible field
        index=True, ondelete='cascade', required=True,
        domain="[('share', '=', False), ('id', 'not in', user_in_teams_ids)]")
    user_in_teams_ids = fields.Many2many(
        'res.users', compute='_compute_user_in_teams_ids',
        help='UX: Give users not to add in the currently chosen team to avoid duplicates')
    active = fields.Boolean(string='Active', default=True)
    is_membership_multi = fields.Boolean(
        'Multiple Memberships Allowed', compute='_compute_is_membership_multi',
        help='If True, users may belong to several sales teams. Otherwise membership is limited to a single sales team.')
    is_in_another_team = fields.Boolean(compute='_compute_is_in_another_team')
    # salesman information
    image_1920 = fields.Image("Image", related="user_id.image_1920", max_width=1920, max_height=1920)
    image_128 = fields.Image("Image (128)", related="user_id.image_128", max_width=128, max_height=128)
    name = fields.Char(string='Name', related='user_id.display_name', readonly=False)
    email = fields.Char(string='Email', related='user_id.email')
    phone = fields.Char(string='Phone', related='user_id.phone')
    mobile = fields.Char(string='Mobile', related='user_id.mobile')
    company_id = fields.Many2one('res.company', string='Company', related='user_id.company_id')

    _sql_constraints = [
        ('crm_team_member_unique',
         'UNIQUE(crm_team_id,user_id)',
         'Error, team / user memberships should not be duplicated.'),
    ]

    @api.depends('crm_team_id.member_ids')
    @api.depends_context('default_crm_team_id')
    def _compute_user_in_teams_ids(self):
        if self.env['ir.config_parameter'].sudo().get_param('sales_team.membership_multi', False):
            member_user_ids = self.env['res.users']
        else:
            member_user_ids = self.env['crm.team.member'].search([]).user_id
        for member in self:
            if member_user_ids:
                member.user_in_teams_ids = member_user_ids
            elif member.crm_team_id:
                member.user_in_teams_ids = member.crm_team_id.member_ids
            elif self.env.context.get('default_crm_team_id'):
                member.user_in_teams_ids = self.env['crm.team'].browse(self.env.context['default_crm_team_id']).member_ids
            else:
                member.user_in_teams_ids = self.env['res.users']

    @api.depends('crm_team_id')
    def _compute_is_membership_multi(self):
        multi_enabled = self.env['ir.config_parameter'].sudo().get_param('sales_team.membership_multi', False)
        for member in self:
            member.is_membership_multi = multi_enabled

    @api.depends('user_id', 'crm_team_id')
    def _compute_is_in_another_team(self):
        existing = self.env['crm.team.member'].search([('user_id', 'in', self.user_id.ids)])
        user_mapping = dict.fromkeys(existing.user_id, self.env['crm.team'])
        for membership in existing:
            user_mapping[membership.user_id] |= membership.crm_team_id
        for member in self:
            if not user_mapping.get(member.user_id):
                member.is_in_another_team = False
                continue
            teams = user_mapping[member.user_id]
            remaining = teams - (member.crm_team_id | member._origin.crm_team_id)
            member.is_in_another_team = len(remaining) > 0

    @api.model_create_multi
    def create(self, values_list):
        """ In mono membership mode: archive other memberships """
        if not self.env['ir.config_parameter'].sudo().get_param('sales_team.membership_multi', False):
            existing = self.search([('user_id', 'in', [values['user_id'] for values in values_list])])
            user_memberships = dict((m.user_id.id, m) for m in existing)
            for values in values_list:
                membership = user_memberships.get(values['user_id'])
                if membership and membership.crm_team_id.id != values['crm_team_id']:
                    membership.active = False
        return super(CrmTeamMember, self).create(values_list)

    def write(self, values):
        """ In mono membership mode: archive other memberships """
        if values.get('crm_team_id') and not self.env['ir.config_parameter'].sudo().get_param('sales_team.membership_multi', False):
            existing = self.search([('user_id', 'in', self.user_id.ids), ('crm_team_id', 'not in', [values['crm_team_id']])])
            existing.active = False
        return super(CrmTeamMember, self).write(values)
