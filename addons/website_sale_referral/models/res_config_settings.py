# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    redirect_page = fields.Char(string="Redirect page", config_parameter='website_sale_referral.redirect_page')

    responsible_id = fields.Many2one(
        'res.users',
        string='Salesperson responsible for reward attribution',
        config_parameter='website_sale_referral.responsible_id')
