# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from ast import literal_eval
import babel
from dateutil.relativedelta import relativedelta
import itertools
import json

from odoo import http, _
from odoo.http import request

DEFAULT_MONTH_RANGE = 3


class SaleTimesheetController(http.Controller):
    # --------------------------------------------------
    # Actions: Stat buttons, ...
    # --------------------------------------------------

    # FIXME: these are the actions for the buttons in the control panel
    def _plan_prepare_actions(self, projects, values):
        actions = []
        if len(projects) == 1:
            if request.env.user.has_group('sales_team.group_sale_salesman'):
                if not projects.sale_line_id and not projects.tasks.mapped('sale_line_id'):
                    actions.append({
                        'label': _("Create a Sales Order"),
                        'type': 'action',
                        'action_id': 'sale_timesheet.project_project_action_multi_create_sale_order',
                        'context': json.dumps({'active_id': projects.id, 'active_model': 'project.project'}),
                    })
            if request.env.user.has_group('sales_team.group_sale_salesman_all_leads'):
                to_invoice_amount = values['dashboard']['profit'].get('to_invoice', False)  # plan project only takes services SO line with timesheet into account
                sale_orders = projects.tasks.mapped('sale_line_id.order_id').filtered(lambda so: so.invoice_status == 'to invoice')
                if to_invoice_amount and sale_orders:
                    if len(sale_orders) == 1:
                        actions.append({
                            'label': _("Create Invoice"),
                            'type': 'action',
                            'action_id': 'sale.action_view_sale_advance_payment_inv',
                            'context': json.dumps({'active_ids': sale_orders.ids, 'active_model': 'project.project'}),
                        })
                    else:
                        actions.append({
                            'label': _("Create Invoice"),
                            'type': 'action',
                            'action_id': 'sale_timesheet.project_project_action_multi_create_invoice',
                            'context': json.dumps({'active_id': projects.id, 'active_model': 'project.project'}),
                        })
        return actions
