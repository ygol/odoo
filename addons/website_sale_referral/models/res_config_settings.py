# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api
from odoo.tools import float_repr
from ast import literal_eval


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    reward_value = fields.Monetary(string="Reward Value", currency_field='company_currency_id', readonly=False)
    company_currency_id = fields.Many2one(
        'res.currency',
        related='company_id.currency_id',
        string="Company Currency",
        readonly=True,
        help='Utility field to express amount currency')

    redirect_page = fields.Char(
        string="Page to promote",
        config_parameter='website_sale_referral.redirect_page',
        help='Choose the page where referees are redirected when they click on the link sent by the referer',
        required=True,
        default=lambda self: self.env["ir.config_parameter"].get_param("web.base.url"))

    responsible_id = fields.Many2one(
        'res.users',
        string='Reward manager',
        config_parameter='website_sale_referral.responsible_id',
        help='This person will get a new activity once a referral reaches the stage "won". Then he can take contact with the referrer to send him a reward')

    salesteam_id = fields.Many2one('crm.team', string="Salesteam", config_parameter='website_sale_referral.salesteam')
    salesperson_id = fields.Many2one('res.users', string="Salesperson", config_parameter='website_sale_referral.salesperson')

    @api.model
    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        res['reward_value'] = literal_eval(self.env['ir.config_parameter'].sudo().get_param('website_sale_referral.reward_value') or '0')
        return res

    def set_values(self):
        res = super(ResConfigSettings, self).set_values()
        self.env['ir.config_parameter'].set_param('website_sale_referral.reward_value', self.reward_value)
        return res
