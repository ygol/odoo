# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_referral_reward_on_lead = fields.Boolean(compute='_compute_group_referral_reward_on_lead', implied_group="website_crm_referral.group_lead_referral", readonly=False, store=True)
    referral_reward_on_lead = fields.Selection([
        ('sale_order', 'Reward based on Sales Order paid'),
        ('lead', 'Reward based on leads won')
    ], required=True, default='sale_order')

    @api.model
    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        if self.env.user.has_group('website_crm_referral.group_lead_referral'):
            res['referral_reward_on_lead'] = 'lead'
        else:
            res['referral_reward_on_lead'] = 'sale_order'
        return res

    @api.depends('referral_reward_on_lead')
    def _compute_group_referral_reward_on_lead(self):
        for wizard in self:
            wizard.group_referral_reward_on_lead = wizard.referral_reward_on_lead == 'lead'
