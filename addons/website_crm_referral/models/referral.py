from odoo import models, api, fields
import uuid


class ReferralTracking(models.Model):
    _inherit = 'referral.tracking'

    lead_id = fields.Many2one('crm.lead')
