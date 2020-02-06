# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models
from odoo.tools.translate import html_translate

class KarmaRank(models.Model):
    _name = 'gamification.karma.rank'
    _description = 'Rank based on karma'
    _inherit = 'image.mixin'
    _order = 'karma_min'

    name = fields.Text(string='Rank Name', translate=True, required=True)
    description = fields.Html(string='Description', translate=html_translate, sanitize_attributes=False,)
    description_motivational = fields.Html(
        string='Motivational', translate=html_translate, sanitize_attributes=False,
        help="Motivational phrase to reach this rank")
    karma_min = fields.Integer(string='Required Karma', required=True, default=1,
        help='Minimum karma needed to reach this rank')
    user_ids = fields.One2many('res.users', 'rank_id', string='Users', help="Users having this rank")

    _sql_constraints = [
        ('karma_min_check', "CHECK( karma_min > 0 )", 'The required karma has to be above 0.')
    ]

    @api.model_create_multi
    def create(self, values_list):
        res = super(KarmaRank, self).create(values_list)
        if res:
            # VFE dunno when it happens to call create without any value in the list
            # but in this case, the mapped returns an empty list and min crashes.
            min_karma_min = min(res.mapped('karma_min'))
            max_karma_min = max(res.mapped('karma_min'))
            users = self.env['res.users'].sudo().search([
                ('karma', '>', min_karma_min),
                ('rank_id.karma_min', '<', max_karma_min),
            ])
            users._recompute_rank()
        return res

    def write(self, vals):
        if 'karma_min' in vals:
            previous_ranks = self.env['gamification.karma.rank'].search([], order="karma_min DESC").ids
            low = min(vals['karma_min'], self.karma_min)
            high = max(vals['karma_min'], self.karma_min)

        res = super(KarmaRank, self).write(vals)

        if 'karma_min' in vals:
            after_ranks = self.env['gamification.karma.rank'].search([], order="karma_min DESC").ids
            if previous_ranks != after_ranks:
                users = self.env['res.users'].sudo().search([('karma', '>', 0)])
            else:
                users = self.env['res.users'].sudo().search([('karma', '>=', low), ('karma', '<=', high)])
            users._recompute_rank()
        return res
