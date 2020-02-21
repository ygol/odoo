# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Uom(models.Model):
    _inherit = 'uom.uom'

    timesheet_widget = fields.Char("Widget", help="Widget used in the webclient when this unit is the one used to encode timesheets.")

    def _get_uom_by_config_parameter(self, parameter):
        return self.browse(int(self.env['ir.config_parameter'].sudo().get_param(parameter)))
