# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class AccountJournal(models.Model):
    _inherit = "account.journal"

    l10n_cl_sequence_ids = fields.Many2many(
        'ir.sequence', 'l10n_cl_journal_sequence_rel', 'journal_id', 'sequence_id', string='Sequences (cl)',
        domain="[('l10n_latam_document_type_id', '!=', False)]")

    def button_create_new_sequences(self):
        self.ensure_one()
        internal_types = ['invoice', 'debit_note', 'credit_note']
        domain = [('country_id.code', '=', 'CL'), ('internal_type', 'in', internal_types)]
        if self.company_id.partner_id.l10n_cl_sii_taxpayer_type in ['1', False]:
            domain += [('code', 'not in', ['70', '71'])]
        elif self.company_id.partner_id.l10n_cl_sii_taxpayer_type == '2':
            domain += [('code', 'not in', ['33', '34'])]
        documents = self.env['l10n_latam.document.type'].search(domain)
        sequences = self.env['ir.sequence']
        for document in documents:
            sequences |= self.env['ir.sequence'].create(document._get_document_sequence_vals(self))
        self.write({'l10n_cl_sequence_ids': [(4, s.id) for s in sequences]})

    def create_document_sequences_cl(self):
        if self.env['ir.sequence'].search([('l10n_latam_document_type_id', '!=', False)]):
            return
        cl_country = self.env.ref('base.cl')
        for journal in self:
            if journal.company_id.country_id != cl_country or journal.type != 'sale' or not journal.l10n_latam_use_documents:
                continue
            else:
                journal.button_create_new_sequences()

    @api.model_create_multi
    def create(self, vals_list):
        """ Create Document sequences after create the journal """
        journals = super().create(vals_list)
        journals.create_document_sequences_cl()
        return journals
