# -*- coding: utf-8 -*-
import itertools

from lxml import etree

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.tools import lazy


class IrActionsActWIndowView(models.Model):
    _inherit = 'ir.actions.act_window.view'

    view_mode = fields.Selection(selection_add=[('qweb', 'QWeb')])

class BaseModel(models.AbstractModel):
    _inherit = 'base'

    @api.model
    def qweb_render_view(self, view_id, domain):
        assert view_id
        return self.env['ir.qweb'].render(
            view_id, {
            **self.env['ir.ui.view']._prepare_qcontext(),
            **self._qweb_prepare_qcontext(view_id, domain),
        })

    def _qweb_prepare_qcontext(self, view_id, domain):
        """
        Base qcontext for rendering qweb views bound to this model
        """
        return {
            'model': self,
            'domain': domain,
            # not necessarily necessary as env is already part of the
            # non-minimal qcontext
            'context': self.env.context,
            'records': lazy(self.search, domain),
        }
