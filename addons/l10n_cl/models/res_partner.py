# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import stdnum

from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    l10n_cl_sii_taxpayer_type = fields.Selection([
        ('1', 'VAT Affected (1st Category)'),
        ('2', 'Fees Receipt Issuer (2nd category)'),
        ('3', 'End Consumer'),
        ('4', 'Foreigner'),
    ], 'Taxpayer Type', index=True,
        help='1 - VAT Affected (1st Category) (Most of the cases)\n'
             '2 - Fees Receipt Issuer (Applies to suppliers who issue fees receipt)\n'
             '3 - End consumer (only receipts)\n'
             '4 - Foreigner',
    )

    @api.model_create_multi
    def create(self, vals_list):
        identification_types = [
            self.env.ref('l10n_latam_base.it_vat'),
            self.env.ref('l10n_cl.it_RUT'),
            self.env.ref('l10n_cl.it_RUN'),
        ]
        chile_country = self.env.ref('base.cl')
        for vals in vals_list:
            if not vals.get('vat'):
                continue
            elif not vals.get('country_id') == chile_country.id:
                continue
            identification_type = self.env['l10n_latam.identification.type'].browse(
                vals.get('l10n_latam_identification_type_id')
            )
            if identification_type and identification_type.country_id != chile_country:
                continue
            elif identification_type and identification_type not in identification_types:
                continue
            vals['vat'] = stdnum.util.get_cc_module('cl', 'vat').format(
                vals['vat']
            ).replace('.', '').replace('CL', '').upper()
        return super().create(vals_list)

    def write(self, values):
        if not self or not set(values.keys()) & set(['vat', 'country_id', 'l10n_latam_identification_type_id']):
            return super().write(values)
        partners = self
        chile_country = self.env.ref('base.cl')
        if 'country_id' in values and values['country_id'] != chile_country.id:
            return super().write(values)
        else:
            partners = partners.filtered(lambda p: p.country_id == chile_country)

        identification_types = [
            self.env.ref('l10n_latam_base.it_vat').id,
            self.env.ref('l10n_cl.it_RUT').id,
            self.env.ref('l10n_cl.it_RUN').id,
        ]
        if 'l10n_latam_identification_type_id' in values:
            identification_type = self.env['l10n_latam.identification.type'].browse(values['l10n_latam_identification_type_id'])
            if identification_type and identification_type.country_id != chile_country:
                return super().write(values)
            elif identification_type and identification_type.id not in identification_types:
                return super().write(values)
        else:
            partners = partners.filtered(
                lambda p: p.l10n_latam_identification_type_id.country_id == chile_country
                and p.l10n_latam_identification_type_id.id in identification_types
            )

        if 'vat' in values:
            # update chilian partners and non chilian partners in batch
            # with new vat value
            vat = values.get('vat')
            if vat:
                chile_vals = dict(values)
                chile_vals['vat'] = stdnum.util.get_cc_module('cl', 'vat').format(
                    values['vat']
                ).replace('.', '').replace('CL', '').upper()
            return super(ResPartner, partners).write(chile_vals) and super(ResPartner, self-partners).write(values)
        else:
            # partner by partner VAT formatting on country/identification type change
            res = super(ResPartner, self-partners).write(values)
            remaining_partners = self.env['res.partner']
            for partner in partners:
                vat = partner.vat
                formatted_vat = stdnum.util.get_cc_module('cl', 'vat').format(vat).replace('.', '').replace('CL', '').upper()
                if formatted_vat != vat:
                    specific_vals = dict(values)
                    specific_vals['vat'] = formatted_vat
                    res |= super(ResPartner, partner).write(values)
                else:
                    remaining_partners += partner
            if remaining_partners:
                res |= super(ResPartner, remaining_partners).write(values)
        return res
