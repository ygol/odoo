# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields

class PublicBazz(models.Model):
    _name = 'test_new_api.bazz'
    _inherit = ['test_new_api.bazz', 'test.inherit.mixin']
