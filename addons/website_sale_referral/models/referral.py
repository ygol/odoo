from odoo import models, api, fields
import uuid


class ReferralTracking(models.Model):
    _name = 'referral.tracking'
    _description = 'Referral'

    referrer = fields.Many2one('res.partner')
    token = fields.Char(default=lambda self: uuid.uuid4().hex, readonly=True, index=True)
