# -*- coding: utf-8 -*-

from odoo import api, models, fields, _
from odoo.exceptions import ValidationError


class ResCompany(models.Model):
    _inherit = 'res.company'

    referral_reward_mode = fields.Selection([
        ('sales_order', 'Reward based on Sales Order paid'),
        ('lead', 'Reward based on leads won')
    ], required=True, default='sales_order')
