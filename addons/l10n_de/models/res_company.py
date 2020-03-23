# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_de_country_code = fields.Char(related='country_id.code', string='Country Code')
    nat_tax_id = fields.Char(string="National Tax ID")
