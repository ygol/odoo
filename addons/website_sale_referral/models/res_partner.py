from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    utm_source_id = fields.Many2one('utm.source', 'Source', ondelete='cascade', groups="base.group_user")

    referrer_to_reward_id = fields.Many2one('res.partner', help='The referrer that was rewarded for this partner')

    reward_done = fields.Boolean(default=False)
