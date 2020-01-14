# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    mail_template_id = fields.Many2one(
        'mail.template',
        string='Referral Email Template')
        #domain=[('model', '=', 'website_sale_referral.referral')])
    #TODO required ?
    #TODO set domain

    responsible_id = fields.Many2one('res.users', string='Salesperson responsible for reward attribution')
