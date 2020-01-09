# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # To save the value
    referral_reward_mode = fields.Selection(related='company_id.referral_reward_mode', required=True, readonly=False)

    # To apply implied_group
    referral_reward_mode_bool = fields.Boolean(implied_group='website_crm_referral.group_lead_referral')

    @api.onchange('referral_reward_mode')
    def _compute_referral_reward_mode_bool(self):
        for r in self:
            r.referral_reward_mode_bool = r.referral_reward_mode == 'sales_order'
