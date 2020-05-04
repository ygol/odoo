from odoo import models

PRODUCT_TYPES = ["consu", "service", "product"]


class ProductProduct(models.Model):
    _inherit = "product.product"

    def _get_types(self):
        # Ensure database population generates some storable products.
        return PRODUCT_TYPES, [0.4, 0.2, 0.4]
