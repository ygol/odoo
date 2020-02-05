from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    referral_tracking_id = fields.Many2one('referral.tracking')