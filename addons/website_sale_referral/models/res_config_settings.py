# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    redirect_page = fields.Char(
        string="Redirect page",
        config_parameter='website_sale_referral.redirect_page',
        help='Choose the page where referees are redirected when they click on the link sent by the referer')

    responsible_id = fields.Many2one(
        'res.users',
        string='Reward responsible',
        config_parameter='website_sale_referral.responsible_id',
        help='This person will get a new activity once a referral reaches the stage "won". Then he can take contact with the referrer to send him a reward')
