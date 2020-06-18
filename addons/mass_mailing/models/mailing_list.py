# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class MassMailingList(models.Model):
    """Model of a contact list. """
    _name = 'mailing.list'
    _order = 'name'
    _description = 'Mailing List'

    name = fields.Char(string='Mailing List', required=True)
    active = fields.Boolean(default=True)
    contact_nbr = fields.Integer(compute="_compute_mailing_list_statistics", string='Number of Contacts')
    contact_nbr_email = fields.Integer(compute="_compute_mailing_list_statistics", string="Number of Emails")
    contact_nbr_opt_out = fields.Integer(compute="_compute_mailing_list_statistics", string="Number of Opted-out")
    contact_percentage_opt_out = fields.Float(compute="_compute_mailing_list_statistics", string="Percentage of Opted-out")
    contact_nbr_blacklisted = fields.Integer(compute="_compute_mailing_list_statistics", string="Number of Blacklisted")
    contact_percentage_blacklisted = fields.Float(compute="_compute_mailing_list_statistics", string="Percentage of Blacklisted")
    contact_percentage_bounce = fields.Float(compute="_compute_mailing_list_statistics", string="Percentage of Bouncing")
    contact_ids = fields.Many2many(
        'mailing.contact', 'mailing_contact_list_rel', 'list_id', 'contact_id',
        string='Mailing Lists')
    mailing_nbr = fields.Integer(compute="_compute_mailing_list_count", string="Number of Mailing")
    mailing_ids = fields.Many2many('mailing.mailing', 'mail_mass_mailing_list_rel', string='Mass Mailings')
    subscription_ids = fields.One2many('mailing.contact.subscription', 'list_id',
        string='Subscription Information')
    is_public = fields.Boolean(default=True, help="The mailing list can be accessible by recipient in the unsubscription"
                                                  " page to allows him to update his subscription preferences.")

    # ------------------------------------------------------
    # COMPUTE / ONCHANGE
    # ------------------------------------------------------

    def _compute_mailing_list_count(self):
        self.env.cr.execute('''
            SELECT mailing_list_id, count(*)
            FROM mail_mass_mailing_list_rel
            GROUP BY mailing_list_id''')
        data = dict(self.env.cr.fetchall())
        for mailing_list in self:
            mailing_list.mailing_nbr = data.get(mailing_list.id, 0)

    def _compute_mailing_list_statistics(self):
        """ Computes various statistics for this mailing.list that allow users
        to have a global idea of its quality (based on blacklist, opt-outs, ...).

        As some fields depend on the value of each other (mainly percentages),
        we compute everything in a single method. """

        contact_counts_per_mailing = self._fetch_contact_nbr_counts()
        bounce_per_mailing = self._fetch_bounce_per_mailing()
        for mailing_list in self:
            contact_counts = contact_counts_per_mailing.get(mailing_list.id, {})
            for field, value in contact_counts.items():
                mailing_list[field] = value

            if mailing_list.contact_nbr != 0:
                mailing_list.contact_percentage_opt_out = 100 * (mailing_list.contact_nbr_opt_out / mailing_list.contact_nbr)
                mailing_list.contact_percentage_blacklisted = 100 * (mailing_list.contact_nbr_blacklisted / mailing_list.contact_nbr)
                mailing_list.contact_percentage_bounce = 100 * (bounce_per_mailing.get(mailing_list.id, 0) / mailing_list.contact_nbr)
            else:
                mailing_list.contact_percentage_opt_out = 0
                mailing_list.contact_percentage_blacklisted = 0
                mailing_list.contact_percentage_bounce = 0

    # ------------------------------------------------------
    # ORM overrides
    # ------------------------------------------------------

    def write(self, vals):
        # Prevent archiving used mailing list
        if 'active' in vals and not vals.get('active'):
            mass_mailings = self.env['mailing.mailing'].search_count([
                ('state', '!=', 'done'),
                ('contact_list_ids', 'in', self.ids),
            ])

            if mass_mailings > 0:
                raise UserError(_("At least one of the mailing list you are trying to archive is used in an ongoing mailing campaign."))

        return super(MassMailingList, self).write(vals)

    def name_get(self):
        return [(list.id, "%s (%s)" % (list.name, list.contact_nbr)) for list in self]

    # ------------------------------------------------------
    # ACTIONS
    # ------------------------------------------------------

    def action_view_contacts(self):
        action = self.env["ir.actions.actions"]._for_xml_id("mass_mailing.action_view_mass_mailing_contacts")
        action['domain'] = [('list_ids', 'in', self.ids)]
        context = dict(self.env.context, default_list_ids=self.ids)
        action['context'] = context
        return action

    def action_view_contacts_email(self):
        action = self.action_view_contacts()
        action['context'] = dict(action.get('context', {}), default_list_ids=self.ids, search_default_filter_valid_email_recipient=1)
        return action

    def action_view_mailings(self):
        action = self.env.ref('mass_mailing.mailing_mailing_action_mail').read()[0]
        action['domain'] = [('id', 'in', self.mailing_ids.ids)]
        context = dict(self.env.context, default_contact_list_ids=self.ids)
        action['context'] = context
        return action

    def action_view_contacts_opt_out(self):
        action = self.env.ref('mass_mailing.action_view_mass_mailing_contacts').read()[0]
        action['domain'] = [('list_ids', 'in', self.id), ('opt_out', '=', True)]
        context = dict(self.env.context, default_list_ids=self.ids)
        action['context'] = context
        return action

    def action_view_contacts_blacklisted(self):
        action = self.env.ref('mass_mailing.action_view_mass_mailing_contacts').read()[0]
        action['domain'] = [('list_ids', 'in', self.id), ('is_blacklisted', '=', True)]
        context = dict(self.env.context, default_list_ids=self.ids)
        action['context'] = context
        return action

    def action_view_contacts_bouncing(self):
        action = self.env.ref('mass_mailing.action_view_mass_mailing_contacts').read()[0]
        action['domain'] = [('list_ids', 'in', self.id), ('message_bounce', '>', 0)]
        context = dict(self.env.context, default_list_ids=self.ids)
        action['context'] = context
        return action

    def action_merge(self, src_lists, archive):
        """
            Insert all the contact from the mailing lists 'src_lists' to the
            mailing list in 'self'. Possibility to archive the mailing lists
            'src_lists' after the merge except the destination mailing list 'self'.
        """
        # Explation of the SQL query with an example. There are the following lists
        # A (id=4): yti@odoo.com; yti@example.com
        # B (id=5): yti@odoo.com; yti@openerp.com
        # C (id=6): nothing
        # To merge the mailing lists A and B into C, we build the view st that looks
        # like this with our example:
        #
        #  contact_id |           email           | row_number |  list_id |
        # ------------+---------------------------+------------------------
        #           4 | yti@odoo.com              |          1 |        4 |
        #           6 | yti@odoo.com              |          2 |        5 |
        #           5 | yti@example.com           |          1 |        4 |
        #           7 | yti@openerp.com           |          1 |        5 |
        #
        # The row_column is kind of an occurence counter for the email address.
        # Then we create the Many2many relation between the destination list and the contacts
        # while avoiding to insert an existing email address (if the destination is in the source
        # for example)
        self.ensure_one()
        # Put destination is sources lists if not already the case
        src_lists |= self
        self.env['mailing.contact'].flush(['email', 'email_normalized'])
        self.env['mailing.contact.subscription'].flush(['contact_id', 'opt_out', 'list_id'])
        self.env.cr.execute("""
            INSERT INTO mailing_contact_list_rel (contact_id, list_id)
            SELECT st.contact_id AS contact_id, %s AS list_id
            FROM
                (
                SELECT
                    contact.id AS contact_id,
                    contact.email AS email,
                    list.id AS list_id,
                    row_number() OVER (PARTITION BY email ORDER BY email) AS rn
                FROM
                    mailing_contact contact,
                    mailing_contact_list_rel contact_list_rel,
                    mailing_list list
                WHERE contact.id=contact_list_rel.contact_id
                AND COALESCE(contact_list_rel.opt_out,FALSE) = FALSE
                AND contact.email_normalized NOT IN (select email from mail_blacklist where active = TRUE)
                AND list.id=contact_list_rel.list_id
                AND list.id IN %s
                AND NOT EXISTS
                    (
                    SELECT 1
                    FROM
                        mailing_contact contact2,
                        mailing_contact_list_rel contact_list_rel2
                    WHERE contact2.email = contact.email
                    AND contact_list_rel2.contact_id = contact2.id
                    AND contact_list_rel2.list_id = %s
                    )
                ) st
            WHERE st.rn = 1;""", (self.id, tuple(src_lists.ids), self.id))
        self.flush()
        self.invalidate_cache()
        if archive:
            (src_lists - self).action_archive()

    def close_dialog(self):
        return {'type': 'ir.actions.act_window_close'}

    # ------------------------------------------------------
    # UTILITY
    # ------------------------------------------------------

    def _fetch_contact_nbr_counts(self):
        """ Compute number of contacts matching various conditions:
        - contact_nbr:              all contacts
        - contact_nbr_email:        all valid emails
        - contact_nbr_opt_out:      all opted-out contacts
        - contact_nbr_blacklisted:  all blacklisted contacts

        The blacklisted condition will be overridden in mass_mailing_sms so that blacklisted
        statistics also take the sms blacklist into account.

        This method will return a dict under the form:
        {
            42: { # 42 being the mailing list ID
                'contact_nbr': 52,
                'contact_nbr_email': 35,
                'contact_nbr_opt_out': 5,
                'contact_nbr_blacklisted': 2
            },
            ...
        } """

        self.env.cr.execute(f'''
            SELECT
                list_id AS mailing_list_id
                ,COUNT(*) AS contact_nbr
                ,SUM(CASE WHEN
                    (c.email_normalized IS NOT NULL
                    AND COALESCE(r.opt_out,FALSE) = FALSE
                    AND bl.id IS NULL)
                    THEN 1 ELSE 0 END) AS contact_nbr_email
                ,SUM(CASE WHEN COALESCE(r.opt_out,FALSE) = TRUE
                    THEN 1 ELSE 0 END) AS contact_nbr_opt_out
                ,SUM(CASE WHEN {self._get_blacklisted_condition()}
                    THEN 1 ELSE 0 END) AS contact_nbr_blacklisted
                {self._get_additional_select_clauses()}
            FROM
                mailing_contact_list_rel r
                LEFT JOIN mailing_contact c ON (r.contact_id=c.id)
                {self._get_blacklist_join()}
            WHERE list_id IN %s
            GROUP BY
                list_id;
        ''', (tuple(self.ids), ))
        res = self.env.cr.dictfetchall()

        contact_nbr_counts = {}
        for res_item in res:
            mailing_list_id = res_item.pop('mailing_list_id')
            contact_nbr_counts[mailing_list_id] = res_item
        return contact_nbr_counts

    def _get_additional_select_clauses(self):
        """" Can be overridden to add other fields to compute. """
        return ''

    def _get_blacklisted_condition(self):
        """ Returns the condition on which a record is considered as 'blacklisted'.
        Extracted to be easily overridable by sub-modules (such as mass_mailing_sms).  """

        return 'bl.id IS NOT NULL'

    def _get_blacklist_join(self):
        """ Extracted to be easily overridable by sub-modules (such as mass_mailing_sms). """
        return "left join mail_blacklist bl on c.email_normalized = bl.email and bl.active"

    def _fetch_bounce_per_mailing(self):
        """ Optimized SQL way of fetching the count of contacts that have
        at least 1 message bouncing for passed mailing.lists """

        sql = '''
            SELECT mclr.list_id, COUNT(DISTINCT mc.id)
            FROM mailing_contact mc
            LEFT OUTER JOIN mailing_contact_list_rel mclr
              ON mc.id = mclr.contact_id
            WHERE mc.message_bounce > 0
            AND mclr.list_id in %s
            GROUP BY mclr.list_id
        '''
        self.env.cr.execute(sql, (tuple(self.ids),))
        return dict(self.env.cr.fetchall())
