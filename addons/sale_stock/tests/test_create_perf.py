from odoo.tests import common, tagged
from odoo.sql_db import flush_env
import logging
import time
_logger = logging.getLogger(__name__)

ENTITIES = 1000
MSG = "Model %s, %i records, %s, time %.2f"

def product_vals():
    vals_list = [{
        "name": "P%i" % i,
        "type": "product",
    } for i in range(ENTITIES)]
    vals_list += [{
        "name": "P%i" % i,
        "type": "consu",
    } for i in range(ENTITIES)]
    return vals_list

def so_vals():
    return [{
        "partner_id": 1,
        "user_id": 1,
        "order_line": [
            (0, 0, {"product_id": 5}),
            (0, 0, {"product_id": 7}),
            (0, 0, {"display_type": "line_note", "name": "NOTE"})
        ]
    } for i in range(ENTITIES)]

def sol_vals():
    return [{
        "partner_id": 1,
        "user_id": 1,
        "order_line": [
            (0, 0, {"product_id": 8, "product_uom_qty": i})
            for i in range(ENTITIES)
        ]
    }]


class TestPERF(common.TransactionCase):

    # def test_1product_batch(self):
    #     model = self.env["product.product"]
    #     vals_list = product_vals()
    #     t0 = time.time()
    #     model.create(vals_list)
    #     t1 = time.time()
    #     _logger.warning(MSG, model._name, ENTITIES, "BATCH", t1 - t0)
    #     flush_env(model.env.cr)
    #     _logger.warning(MSG, model._name, ENTITIES, "FLUSH", time.time() - t1)

    # def test_2product_unique(self):
    #     model = self.env["product.product"]
    #     vals = product_vals()
    #     t0 = time.time()
    #     for val in vals:
    #         model.create(val)
    #         flush_env(model.env.cr)
    #     _logger.warning(MSG, model._name, ENTITIES, "UNIQUE", time.time() - t0)

    def test_3sale_order_batch(self):
        model = self.env["sale.order"]
        vals_list = so_vals()
        t0 = time.time()
        model.create(vals_list)
        t1 = time.time()
        _logger.warning(MSG, model._name, ENTITIES, "BATCH", t1 - t0)
        flush_env(model.env.cr)
        _logger.warning(MSG, model._name, ENTITIES, "FLUSH", time.time() - t1)

    # def test_4sale_order_line_batch(self):
    #     model = self.env["sale.order"]
    #     vals_list = sol_vals()
    #     t0 = time.time()
    #     model.create(vals_list)
    #     t1 = time.time()
    #     _logger.warning(MSG, "sale.order.line", ENTITIES, "BATCH", t1 - t0)
    #     flush_env(model.env.cr)
    #     _logger.warning(MSG, "sale.order.line", ENTITIES, "FLUSH", time.time() - t1)

    # c/c II
    # t0 = time.time()
    # model = self.env["product.product"]
    # for i in range(ENTITIES):
    #     model.create(dict())
    # _logger.warning(MSG, model._name, ENTITIES, "UNIQUE", time.time() - t0)

    # def test_4sale_order_unique(self):
    #     model = self.env["sale.order"]
    #     vals = so_vals()
    #     t0 = time.time()
    #     for val in vals:
    #         model.create(val)
    #         flush_env(model.env.cr)
    #     _logger.warning(MSG, model._name, ENTITIES, "UNIQUE", time.time() - t0)

    # # def test_sale_order_line_unique(self):
    # #     t0 = time.time()
    # #     model = self.env["product.product"]
    # #     for i in range(ENTITIES):
    # #         model.create(dict())
    # #     _logger.warning(MSG, model._name, ENTITIES, "UNIQUE", time.time() - t0)
