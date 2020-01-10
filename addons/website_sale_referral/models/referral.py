from odoo import models, api, fields
import uuid


class ReferralTracking(models.Model):
    _name = 'referral.tracking'
    _description = 'Referral'

    referrer_utm_source_id = fields.Many2one('utm.source')
    token = fields.Char(default=lambda self: uuid.uuid4().hex, readonly=True, index=True)
