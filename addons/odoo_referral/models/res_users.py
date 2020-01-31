from odoo import api, models, fields


class Users(models.Model):
    _inherit = 'res.users'

    referral_updates_last_fetch_time = fields.Datetime(description='The last time the referral updates were fetched from odoo.com')
    referral_updates_count = fields.Integer(default=-1)
