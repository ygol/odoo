# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _
from lxml import etree
import base64
from odoo.tools import float_repr
from odoo.tests.common import Form
from odoo.exceptions import UserError
from odoo.osv import expression


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    # -------------------------------------------------------------------------
    # Export
    # -------------------------------------------------------------------------

    def _check_for_incompatibilities(self, invoice):
        '''Throws an error if some information is missing to generate valid UBL'''

        if not invoice.company_id.partner_id.commercial_partner_id.peppol_endpoint_scheme:
            return _('Only companies with a European VAT are supported')
            # See PEPPOL_COUNTRY_EAS : only those VAT number are supported.
            # Other identification are possible but not yet implemented in Odoo, see : https://docs.peppol.eu/poacc/billing/3.0/codelist/eas/
        if not invoice.company_id.partner_id.commercial_partner_id.peppol_endpoint:
            return _('Please set a vat number on the seller\'s company')

        if not invoice.commercial_partner_id.peppol_endpoint_scheme:
            return _('Only companies with a European VAT are supported (customer)')
        if not invoice.commercial_partner_id.peppol_endpoint:
            return _('Please set a vat number on the customer\'s company')
        return False

    def _export_peppol(self, invoice):
        self.ensure_one()

        def format_monetary(amount, currency=invoice.currency_id):
            # Format the monetary values to avoid trailing decimals (e.g. 90.85000000000001).
            return float_repr(amount, currency.decimal_places)

        def convert_monetary(amount, from_currency):
            # All monetary should be in the invoice currency, except for vat total
            return from_currency._convert(amount, invoice.currency_id, invoice.company_id, invoice.invoice_date)

        def get_tax_total():
            breakdown = {}
            for line in invoice.invoice_line_ids:
                line_taxes = line.tax_ids.compute_all(
                    line.price_unit,
                    quantity=line.quantity,
                    product=line.product_id,
                    partner=invoice.partner_id)['taxes']
                currency = line.currency_id or invoice.currency_id
                if line_taxes:
                    for tax in line_taxes:
                        tax_category = 'S' if tax['amount'] else 'Z'
                        tax_percent = self.env['account.tax'].browse(tax['id']).amount
                    if (tax_category, tax_percent) not in breakdown:
                        breakdown[(tax_category, tax_percent)] = {'base': 0, 'amount': 0}
                    breakdown[(tax_category, tax_percent)]['base'] = currency._convert(tax['base'], invoice.currency_id, invoice.company_id, invoice.invoice_date)
                    breakdown[(tax_category, tax_percent)]['amount'] = currency._convert(tax['amount'], invoice.currency_id, invoice.company_id, invoice.invoice_date)
                else:
                    if ('Z', 0) not in breakdown:
                        breakdown[('Z', 0)] = {'base': 0, 'amount': 0}
                    breakdown[('Z', 0)]['base'] += line.price_subtotal

            return {'amount': invoice.amount_tax,
                    'seller_currency': invoice.company_id.partner_id.commercial_partner_id.country_id.currency_id,
                    'amount_seller_currency': invoice.currency_id._convert(invoice.amount_tax, invoice.company_id.partner_id.commercial_partner_id.country_id.currency_id, invoice.company_id, invoice.invoice_date),
                    'breakdown': breakdown}

        error = self._check_for_incompatibilities(invoice)
        if error:
            return {'error': error}

        # Create file content.
        data = {
            'invoice': invoice,

            'type_code': 380 if invoice.move_type == 'out_invoice' else 381,
            'payment_means_code': 42 if invoice.journal_id.bank_account_id else 31,

            'format_monetary': format_monetary,
            'convert_monetary': convert_monetary,
            'tax_total': get_tax_total()
        }
        if invoice.invoice_date_due:
            data['due_date'] = invoice.invoice_date_due.strftime("%Y-%m-%d")

        xml_content = self.env.ref('account_edi_peppol.export_peppol_invoice')._render(data)
        xml_name = '%s_peppol_bis3.xml' % (invoice.name.replace('/', '_'))
        return {'attachment': self.env['ir.attachment'].create({
            'name': xml_name,
            'datas': base64.encodebytes(xml_content),
            'res_model': 'account.move',
            'res_id': invoice._origin.id,
            'mimetype': 'application/xml'
        })}

    # -------------------------------------------------------------------------
    # Import
    # -------------------------------------------------------------------------

    def _is_peppol(self, filename, tree):
        tag = tree.tag == '{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice'
        profile = tree.xpath("//*[local-name()='ProfileID']")
        profile = profile[0].text == 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0' if profile else False

        return self.code == 'peppol_3_10' and tag and profile

    def _decode_peppol(self, tree, invoice):

        def _get_ubl_namespaces():
            ''' If the namespace is declared with xmlns='...', the namespaces map contains the 'None' key that causes an
            TypeError: empty namespace prefix is not supported in XPath
            Then, we need to remap arbitrarily this key.

            :param tree: An instance of etree.
            :return: The namespaces map without 'None' key.
            '''
            namespaces = tree.nsmap
            namespaces['inv'] = namespaces.pop(None)
            return namespaces

        self.ensure_one()
        namespaces = _get_ubl_namespaces()

        type = 'in_invoice'

        default_journal = invoice.with_context(default_move_type=type)._get_default_journal()

        with Form(invoice.with_context(default_move_type=type, default_journal_id=default_journal.id)) as invoice_form:
            # Reference
            elements = tree.xpath('//cbc:ID', namespaces=namespaces)
            if elements:
                invoice_form.ref = elements[0].text

            # Dates
            elements = tree.xpath('//cbc:IssueDate', namespaces=namespaces)
            if elements:
                invoice_form.invoice_date = elements[0].text
            elements = tree.xpath('//cbc:DueDate', namespaces=namespaces)
            if elements:
                invoice_form.invoice_date_due = elements[0].text

            # Currency
            elements = tree.xpath('//cbc:DocumentCurrencyCode', namespaces=namespaces)
            currency_code = elements and elements[0].text or ''
            currency = self.env['res.currency'].search([('name', '=', currency_code.upper())], limit=1)
            if currency:
                invoice_form.currency_id = currency

            # Partner
            partner_element = tree.xpath('//cac:AccountingSupplierParty/cac:Party', namespaces=namespaces)
            if partner_element:
                domains = []
                partner_element = partner_element[0]
                elements = partner_element.xpath('//cac:AccountingSupplierParty/cac:Party//cbc:Name', namespaces=namespaces)
                if elements:
                    partner_name = elements[0].text
                    domains.append([('name', 'ilike', partner_name)])
                else:
                    partner_name = ''
                elements = partner_element.xpath('//cac:AccountingSupplierParty/cac:Party//cbc:Telephone', namespaces=namespaces)
                if elements:
                    partner_telephone = elements[0].text
                    domains.append([('phone', '=', partner_telephone), ('mobile', '=', partner_telephone)])
                elements = partner_element.xpath('//cac:AccountingSupplierParty/cac:Party//cbc:ElectronicMail', namespaces=namespaces)
                if elements:
                    partner_mail = elements[0].text
                    domains.append([('email', '=', partner_mail)])
                elements = partner_element.xpath('//cac:AccountingSupplierParty/cac:Party//cbc:ID', namespaces=namespaces)
                if elements:
                    partner_id = elements[0].text
                    domains.append([('vat', 'like', partner_id)])

                if domains:
                    partner = self.env['res.partner'].search(expression.OR(domains), limit=1)
                    if partner:
                        invoice_form.partner_id = partner
                        partner_name = partner.name
                    else:
                        invoice_form.partner_id = self.env['res.partner']

            # Lines
            lines_elements = tree.xpath('//cac:InvoiceLine', namespaces=namespaces)
            for eline in lines_elements:
                with invoice_form.invoice_line_ids.new() as invoice_line_form:
                    # Product
                    elements = eline.xpath('cac:Item/cac:SellersItemIdentification/cbc:ID', namespaces=namespaces)
                    domains = []
                    if elements:
                        product_code = elements[0].text
                        domains.append([('default_code', '=', product_code)])
                    elements = eline.xpath('cac:Item/cac:StandardItemIdentification/cbc:ID[@schemeID=\'0160\']', namespaces=namespaces)
                    if elements:
                        product_ean13 = elements[0].text
                        domains.append([('ean13', '=', product_ean13)])
                    if domains:
                        product = self.env['product.product'].search(expression.OR(domains), limit=1)
                        if product:
                            invoice_line_form.product_id = product

                    # Quantity
                    elements = eline.xpath('cbc:InvoicedQuantity', namespaces=namespaces)
                    quantity = elements and float(elements[0].text) or 1.0
                    invoice_line_form.quantity = quantity

                    # Price Unit
                    elements = eline.xpath('cac:Price/cbc:PriceAmount', namespaces=namespaces)
                    price_unit = elements and float(elements[0].text) or 0.0
                    line_extension_amount = elements and float(elements[0].text) or 0.0
                    invoice_line_form.price_unit = price_unit or line_extension_amount / invoice_line_form.quantity or 0.0

                    # Name
                    elements = eline.xpath('cac:Item/cbc:Description', namespaces=namespaces)
                    invoice_line_form.name = elements and elements[0].text or ''
                    invoice_line_form.name = invoice_line_form.name.replace('%month%', str(fields.Date.to_date(invoice_form.invoice_date).month))  # TODO: full name in locale
                    invoice_line_form.name = invoice_line_form.name.replace('%year%', str(fields.Date.to_date(invoice_form.invoice_date).year))

                    # Taxes
                    tax_element = eline.xpath('cac:Item/cac:ClassifiedTaxCategory', namespaces=namespaces)
                    invoice_line_form.tax_ids.clear()
                    if tax_element:
                        elements = tax_element[0].xpath('cbc:Percent', namespaces=namespaces)
                        if elements:
                            tax = self.env['account.tax'].search([
                                ('company_id', '=', self.env.company.id),
                                ('amount', '=', float(elements[0].text)),
                                ('type_tax_use', '=', invoice_form.journal_id.type),
                            ], order='sequence ASC', limit=1)
                            if tax:
                                invoice_line_form.tax_ids.add(tax)

        return invoice_form.save()

    # -------------------------------------------------------------------------
    # BUSINESS FLOW: EDI (Export)
    # -------------------------------------------------------------------------

    def _post_invoice_edi(self, invoices, test_mode=False):
        self.ensure_one()
        if self.code != 'peppol_3_10':
            return super()._post_invoice_edi(invoices, test_mode=test_mode)
        res = {}
        for invoice in invoices:
            res[invoice] = self._export_peppol(invoice)
        return res

    # -------------------------------------------------------------------------
    # BUSINESS FLOW: EDI (Import)
    # -------------------------------------------------------------------------

    def _create_invoice_from_xml_tree(self, filename, tree):
        self.ensure_one()
        if self._is_peppol(filename, tree):
            return self._decode_peppol()(tree, self.env['account_move'])
        return super()._create_invoice_from_xml_tree(filename, tree)

    def _update_invoice_from_xml_tree(self, filename, tree, invoice):
        self.ensure_one()
        if self._is_peppol(filename, tree):
            return self._decode_peppol(tree, invoice)
        return super()._update_invoice_from_xml_tree(filename, tree, invoice)
