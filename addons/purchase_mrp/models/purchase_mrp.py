# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import float_compare


class MrpProduction(models.Model):
    _inherit = 'mrp.production'

    purchase_orders_ids = fields.Many2many('purchase.order', 'purchase_production_rel', 'purchase_id', 'production_id',
                                           string="Purchase Orders Generate")
    purchase_orders_count = fields.Integer("Number of Purchase Generate", compute='_compute_purchase_orders_count', store=True)

    @api.depends('purchase_orders_ids')
    def _compute_purchase_orders_count(self):
        for production in self:
            production.purchase_orders_count = len(production.purchase_orders_ids)

    def _get_document_iterate_key(self, move_raw_id):
        return super(MrpProduction, self)._get_document_iterate_key(move_raw_id) or 'created_purchase_line_id'

    def action_see_purchase_orders(self):
        self.ensure_one()
        return {
            'name': _('Purchase generated by %s' % self.name),
            'domain': [('id', 'in', self.purchase_orders_ids.ids)],
            'res_model': 'purchase.order',
            'type': 'ir.actions.act_window',
            'view_mode': 'tree,form',
            'context': dict(self._context, create=False),

        }


class PurchaseOrder(models.Model):
    _inherit = 'purchase.order'

    mrp_production_ids = fields.Many2many('mrp.production', 'purchase_production_rel', 'production_id', 'purchase_id',
                                          compute='_compute_mrp_production_ids', store=True, string="Manufacturing orders source")
    mrp_production_count = fields.Integer("Number of Source Manufacturing Order", compute='_compute_mrp_production_count', store=True)

    @api.depends('mrp_production_ids')
    def _compute_mrp_production_count(self):
        for purchase in self:
            purchase.mrp_production_count = len(purchase.mrp_production_ids)

    @api.depends('order_line.move_dest_ids.raw_material_production_id')
    def _compute_mrp_production_ids(self):
        for purchase in self:
            purchase.mrp_production_ids = purchase.order_line.move_dest_ids and purchase.order_line.move_dest_ids.raw_material_production_id or False

    def action_see_mrp_production(self):
        self.ensure_one()
        return {
            'name': _('Manufacturing order sources of %s' % self.name),
            'domain': [('id', 'in', self.mrp_production_ids.ids)],
            'res_model': 'mrp.production',
            'type': 'ir.actions.act_window',
            'view_mode': 'tree,form',
        }


class PurchaseOrderLine(models.Model):
    _inherit = 'purchase.order.line'

    def _compute_qty_received(self):
        super(PurchaseOrderLine, self)._compute_qty_received()
        for line in self:
            if line.qty_received_method == 'stock_moves' and line.move_ids:
                kit_bom = self.env['mrp.bom']._bom_find(product=line.product_id, company_id=line.company_id.id, bom_type='phantom')
                if kit_bom:
                    moves = line.move_ids.filtered(lambda m: m.state == 'done' and not m.scrapped)
                    order_qty = line.product_uom._compute_quantity(line.product_uom_qty, kit_bom.product_uom_id)
                    filters = {
                        'incoming_moves': lambda m: m.location_id.usage == 'supplier' and (not m.origin_returned_move_id or (m.origin_returned_move_id and m.to_refund)),
                        'outgoing_moves': lambda m: m.location_id.usage != 'supplier' and m.to_refund
                    }
                    line.qty_received = moves._compute_kit_quantities(line.product_id, order_qty, kit_bom, filters)

    def _get_upstream_documents_and_responsibles(self, visited):
        return [(self.order_id, self.order_id.user_id, visited)]


class StockMove(models.Model):
    _inherit = 'stock.move'

    def _prepare_phantom_move_values(self, bom_line, product_qty, quantity_done):
        vals = super(StockMove, self)._prepare_phantom_move_values(bom_line, product_qty, quantity_done)
        if self.purchase_line_id:
            vals['purchase_line_id'] = self.purchase_line_id.id
        return vals
