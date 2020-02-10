from odoo.addons.portal.controllers.portal import pager as portal_pager, CustomerPortal
from odoo.http import request


class CustomerPortal(CustomerPortal):

    def _prepare_portal_layout_values(self):
        values = super(CustomerPortal, self)._prepare_portal_layout_values()
        c = request.env.user.get_referral_updates_count()
        values['referral_updates_count'] = c if c > -1 else ''
        values['referral_link'] = request.env.user.get_referral_link()
        return values
