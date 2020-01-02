from odoo import models, fields


class Lead(models.Model):
    _inherit = 'crm.lead'

    referral_id = fields.Many2one('website_crm_referral.referral')
