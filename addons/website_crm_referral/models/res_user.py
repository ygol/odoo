from odoo import api, fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    utm_source_id = fields.Many2one('utm.source', 'Source', ondelete='cascade', groups="base.group_user")
