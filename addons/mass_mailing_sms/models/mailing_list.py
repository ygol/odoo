# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class MailingList(models.Model):
    _inherit = 'mailing.list'

    contact_nbr_sms = fields.Integer(compute="_compute_mailing_list_statistics", string="SMS Contacts")

    def _get_additional_select_clauses(self):
        return '''
            ,SUM(CASE WHEN
                (c.phone_sanitized IS NOT NULL
                AND COALESCE(r.opt_out,FALSE) = FALSE
                AND bl_sms.id IS NULL)
            THEN 1 ELSE 0 END) AS contact_nbr_sms'''

    def _get_blacklist_join(self):
        return super(MailingList, self)._get_blacklist_join() + '''
            LEFT JOIN phone_blacklist bl_sms ON c.phone_sanitized = bl_sms.number and bl_sms.active
        '''

    def _get_blacklisted_condition(self):
        return '(bl.id IS NOT NULL OR bl_sms.id IS NOT NULL)'

    def action_view_contacts_sms(self):
        action = self.action_view_contacts()
        action['context'] = dict(action.get('context', {}), search_default_filter_valid_sms_recipient=1)
        return action
