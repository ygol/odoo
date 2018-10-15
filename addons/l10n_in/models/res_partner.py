# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class AccountFiscalPosition(models.Model):
    _inherit = 'account.fiscal.position'

    l10n_in_supply_type = fields.Selection([
        ('inter_state', 'Inter State'),
        ('export_import', 'Export/Import')
    ], string="Supply Type")

    @api.model
    def _get_fpos_by_region(self, country_id=False, state_id=False, zipcode=False, vat_required=False):
        company_id = self.env.context.get('force_company') or self.env.context.get('company_id') or self.env.user.company_id.id
        if self.env['res.company'].browse(company_id).country_id.code == 'IN':
            return False
        return super(AccountFiscalPosition, self)._get_fpos_by_region(country_id=country_id, state_id=state_id, zipcode=zipcode, vat_required=vat_required)

    @api.model
    def get_fiscal_position(self, partner_id, delivery_id=None):
        fiscal_position = super(AccountFiscalPosition, self).get_fiscal_position(partner_id=partner_id, delivery_id=delivery_id)
        company_id = self.env.context.get('force_company') or self.env.context.get('company_id') or self.env.user.company_id.id
        if fiscal_position or self.env['res.company'].browse(company_id).country_id.code != 'IN':
            return fiscal_position
        fiscal_position = self.env['account.fiscal.position']
        l10n_in_gstin_partner_id = self.env.context.get('l10n_in_gstin_partner_id')
        if l10n_in_gstin_partner_id and partner_id:
            partner = self.env['res.partner'].browse(partner_id)
            gstin_partner = self.env['res.partner'].browse(l10n_in_gstin_partner_id)
            supply_type = False
            if partner.state_id != gstin_partner.state_id:
                supply_type = 'inter_state'
            if partner.state_id.country_id != gstin_partner.country_id:
                supply_type = 'export_import'
            if supply_type:
                fiscal_position = self.search([
                    ('company_id', '=', company_id), ('auto_apply', '=', True),
                    ('l10n_in_supply_type', '=', supply_type)
                ], limit=1)
        return fiscal_position.id


class ResPartner(models.Model):
    _inherit = 'res.partner'

    # Use for Multi GSTIN
    l10n_in_gstin_company_id = fields.Many2one('res.company', string="GSTIN Company")
    # Use in view attrs. Need to required state_id if Country is India.
    l10n_in_country_code = fields.Char(related="country_id.code", string="Country code")

    @api.constrains('vat', 'country_id')
    def l10n_in_check_vat(self):
        for partner in self.filtered(lambda p: p.commercial_partner_id.country_id.code == 'IN' and p.vat and len(p.vat) != 15):
            raise ValidationError(_('The GSTIN [%s] for partner [%s] should be 15 characters only.') % (partner.vat, partner.name))
