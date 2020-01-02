from odoo import models,fields


class Lead(models.Model):
    _inherit='crm.lead'

    referral = fields.Many2one('website_crm_referral.referral')