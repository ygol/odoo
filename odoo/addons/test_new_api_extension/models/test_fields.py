from odoo import api, fields, models
from odoo.exceptions import ValidationError

class DummyModel(models.Model):
    _inherit = 'test_new_api.dummy'
    _description = 'basic model with two fields (with & without defaults)'

    new_computed_field = fields.Char(required=True, store=True, compute="_compute_field")

    # Test no warning when adding required computed stored field
    def _compute_field(self):
        self.new_computed_field = "new"
