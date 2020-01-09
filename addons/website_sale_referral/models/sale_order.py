from odoo import models, fields, api


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    is_fully_paid = fields.Boolean(compute='_compute_is_fully_paid', store=True)

    # TODO delete
    @api.depends('state', 'is_expired', 'require_payment', 'amount_total', 'transaction_ids')
    def _compute_is_fully_paid(self):
        for so in self:
            is_fully_paid = so.has_to_be_paid()
