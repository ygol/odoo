from odoo import fields, models, api
from odoo.exceptions import UserError
import uuid


class ReferralCampaign(models.Model):
    _name = 'website_crm_referral.referral.campaign'
    _description = 'Referral campaign'

    name = fields.Char()
    subject = fields.Char()
    reward = fields.Char()
    description = fields.Html()
    referrals = fields.One2many('website_crm_referral.referral', 'campaign_id')
    mail_template_id = fields.Many2one(
        'mail.template',
        string='Email Template',
        domain=[('model', '=', 'website_crm_referral.referral')])
    crm_stages = fields.Many2many('crm.stage', string="CRM Stages")


class Referral(models.Model):
    _name = 'website_crm_referral.referral'
    _description = 'Referral'

    user_id = fields.Many2one('res.users', string='Referrer', required=True)
    referred_id = fields.Many2one('res.partner', required=True)
    comment = fields.Text()
    channel = fields.Selection([
        ('direct', 'Link'),
        ('facebook', 'Facebook'),
        ('twitter', 'Twitter'),
        ('linkedin', 'Linkedin')], default='direct', required=True)
    url = fields.Char(readonly=True, compute='_compute_url')
    lead_id = fields.Many2one('crm.lead')
    crm_stage_id = fields.Many2one(related='lead_id.stage_id', string='CRM Stage')
    campaign_id = fields.Many2one('website_crm_referral.referral.campaign', required=True)

    @api.depends('channel')
    def _compute_url(self):
        if not self.env.user.utm_source_id:
            utm_name = ('%s-%s') % (self.env.user.name, str(uuid.uuid4())[:6])
            self.env.user.utm_source_id = self.env['utm.source'].sudo().create({'name': utm_name}).id

        link_tracker = self.env['link.tracker'].sudo().create({
            'url': '/referral',  #TODO : id for specific referral
            #TODO 'campaign_id': self.env.ref(customer_referralProgram''),
            'source_id': self.env.user.utm_source_id.id,
            'medium_id': self.env.ref('utm.utm_medium_%s' % self.channel).id
        })
        if self.channel == 'direct':
            self.url = link_tracker.short_url
        elif self.channel == 'facebook':
            self.url = 'https://www.facebook.com/sharer/sharer.php?u=%s' % link_tracker.short_url
        elif self.channel == 'twitter':
            self.url = 'https://twitter.com/intent/tweet?tw_p=tweetbutton&text=Amazing job offer for %s! Check it live: %s' % (self.job_id.name, link_tracker.short_url)
        elif self.channel == 'linkedin':
            self.url = 'https://www.linkedin.com/shareArticle?mini=true&url=%s' % link_tracker.short_url

    def send_mail_to_referred(self):
        self.ensure_one()
        self.campaign_id.mail_template_id.sudo().send_mail(self.id, force_send=True)

    def send_mail_update_to_referrer(self, template_id):
        self.ensure_one()
        template = self.env.ref('website_crm_referral.' + template_id)
        template.send_mail(self.id)

    def create_lead(self):
        self.ensure_one()
        if(self.lead_id):
            raise UserError(_("This referral already has a lead."))

        lead = self.env['crm.lead'].sudo().create({
            'name': 'Referral',
            'type': 'lead',
            'partner_id': self.referred_id.id,
            'user_id': self.user_id.id,
            'team_id': None,
            'description': self.comment,
            'referred': self.referred_id.name,
            'source_id': self.env.user.utm_source_id.id,
            'referral_id': self.id,
        })
        stages = sorted(self.campaign_id.crm_stages, key=lambda s: s.sequence)
        if(len(stages) > 0):
            lead.sudo().update({'stage_id': stages[0].id})

        self.sudo().update({'lead_id': lead.id})

        return lead
