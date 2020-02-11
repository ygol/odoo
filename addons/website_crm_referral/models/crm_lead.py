from odoo import models, fields, api, _, SUPERUSER_ID
from ast import literal_eval


class Lead(models.Model):
    _name = 'crm.lead'
    _inherit = ['crm.lead', 'referral.mixin']

    referred_email = fields.Char(string="Referral email", related='email_from', description="The email used to identify the referred")
    referred_name = fields.Char(string="Referral name", related='contact_name', description="The name of the referred")
    referred_company = fields.Char(string="Referral company", related='partner_name', description="The company of the referred")

    def _get_state_for_referral(self):
        self.ensure_one()
        first_stage = self.env['crm.stage'].search([], limit=1).id
        r = 'in_progress'
        if not self.active and self.probability == 0:
            r = 'cancel'
        elif self.type == 'lead' or self.stage_id.id == first_stage:
            r = 'new'
        elif self.stage_id.is_won:
            r = 'done'
        return r

    def write(self, vals):
        if self.campaign_id == self.env.ref('website_sale_referral.utm_campaign_referral') and \
           self.env.user.has_group('website_crm_referral.group_lead_referral') and \
           not self.to_reward and \
           any([elem in vals for elem in ['stage_id', 'type', 'active', 'probability']]):
            old_state = self.get_referral_statuses(self.source_id, self.referred_email)['state']
            r = super().write(vals)
            new_state = self.get_referral_statuses(self.source_id, self.referred_email)['state']

            self.check_referral_progress(old_state, new_state)

            return r
        else:
            return super().write(vals)

    @api.model
    def create(self, vals):
        if(vals.get('campaign_id', None) == self.env.ref('website_sale_referral.utm_campaign_referral').id):
            if('user_id' not in vals):
                salesperson = literal_eval(self.env['ir.config_parameter'].sudo().get_param('website_sale_referral.salesperson') or 'None')
                if(salesperson):
                    vals['user_id'] = salesperson
            if('team_id' not in vals):
                salesteam = literal_eval(self.env['ir.config_parameter'].sudo().get_param('website_sale_referral.salesteam') or 'None')
                if(salesteam):
                    vals['team_id'] = salesteam

            tags = [(6, 0, literal_eval(self.env['ir.config_parameter'].sudo().get_param('website_sale_referral.lead_tag_ids') or '[]'))]
            if(tags):
                if('tag_ids' in vals):
                    vals['tag_ids'].extend(tags)
                else:
                    vals['tag_ids'] = tags
        return super(Lead, self).create(vals)
