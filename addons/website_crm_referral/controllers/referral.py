from odoo import http
from odoo.http import request


class Referral(http.Controller):

    @http.route('/referral', auth='user', website=True)
    def referral(self, **kwargs):
        Campaign = request.env['website_crm_referral.referral.campaign']
        campaign = Campaign.search([], limit=1)  # La vue ne supporte qu'une campagne, et il n'y en a qu'une pour l'instant. TODO changer la vue
        return request.render('website_crm_referral.referral_controller_template',
                              {'campaign': campaign,
                               'referrals': campaign.referrals.search([('campaign_id', '=', campaign.id), ('user_id', '=', request.uid)]),
                               })

    @http.route(['/referral/create'], type='http', auth="user", method='POST', website=True)
    def referral_create(self, **post):
        user = request.env.user
        company = None
        if post.get('company'):
            company = request.env['res.company'].sudo().search([('name', '=', post.get('company'))], limit=1)
            if not company:
                company = request.env['res.company'].create({
                    'name': post.get('name'),
                })

        referred = request.env['res.partner'].sudo().search([
            ('name', '=', post.get('name')),
            ('email', '=', post.get('email'))], limit=1)
        if not referred:
            referred = request.env['res.partner'].create({
                'name': post.get('name'),
                'email': post.get('email'),
                'phone': post.get('phone'),
            })
            if company:
                referred.update({'company_id': company.id})

        referral = request.env['website_crm_referral.referral'].create({
            'user_id': user.id,
            'referred_id': referred.id,
            'comment': post.get('comment'),
            'channel': post.get('channel'),
            'campaign_id': int(post.get('campaign_id')),
        })

        referral.create_lead()

        if(post.get('channel') == 'direct'):
            referral.send_mail_to_referred()

        if(post.get('channel') == 'direct'):
            return request.redirect('/referral')
        else:
            return request.redirect(referral.url)
