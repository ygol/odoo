# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    lead_creation_mode = fields.Selection([('sales_order', 'Reward based on Sales Order paid'), ('lead', 'Reward based on leads won')], required=True, default='sales_order')
