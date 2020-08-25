# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

#
# Order Point Method:
#    - Order if the virtual stock of today is below the min of the defined order point
#

from odoo import models, tools

import logging

_logger = logging.getLogger(__name__)


class StockSchedulerCompute(models.TransientModel):
    _name = 'stock.scheduler.compute'
    _description = 'Run Scheduler Manually'

    def _procure_calculation_orderpoint(self):
        scheduler_cron = self.sudo().env.ref('stock.ir_cron_scheduler_action')
        # Avoid to run the scheduler multiple times in the same time
        try:
            with tools.mute_logger('odoo.sql_db'):
                self._cr.execute("SELECT id FROM ir_cron WHERE id = %s FOR UPDATE NOWAIT", (scheduler_cron.id,))
        except Exception:
            _logger.info('Attempt to run procurement scheduler aborted, as already running')
        else:
            for company in self.env.user.company_ids:
                cids = (self.env.user.company_id | self.env.user.company_ids).ids
                self.env['procurement.group'].with_context(allowed_company_ids=cids).run_scheduler(
                    use_new_cursor=self._cr.dbname,
                    company_id=company.id)

    def procure_calculation(self):
        self.env['ir.async'].with_context().call(self._procure_calculation_orderpoint, description="Stock Scheduler")
        return {'type': 'ir.actions.act_window_close'}
