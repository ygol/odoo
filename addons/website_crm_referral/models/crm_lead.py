from odoo import models, fields, api

STATES_PRIORITY = {'cancel': 0, 'new': 1, 'in_progress': 2, 'done': 3}


class Lead(models.Model):
    _inherit = 'crm.lead'

    def get_referral_statuses(self, referrer, referred=None):
        criteria = [
            ('campaign_id', '=', self.env.ref('website_sale_referral.utm_campaign_referral').id),
            ('source_id', '=', referrer.sudo().utm_source_id.id)]
        if(referred):
            criteria.append(('partner_id', '=', referred.id))
        leads = self.search(criteria)

        result = {}
        for l in leads:
            state = l._get_state_for_referral()
            if(l.partner_id not in result or STATES_PRIORITY[state] > STATES_PRIORITY[result[l.partner_id]]):
                result[l.partner_id] = state

        if referred:
            return result[referred]
        else:
            return result

    def get_state_for_referral(self):
        self.ensure_one()
        first_stage = self.env['crm.stage'].search([], limit=1).id  # ordered automatically by orm
        r = 'in_progress'
        if self.type == 'lead' or self.stage_id.id == first_stage:
            r = 'new'
        elif l.stage_id.is_won:
            r = 'done'
        elif l.stage_id.name == 'cancel':  # TODO does this stage really exist ?
            r = 'cancel'
        return r

    def write(self, vals):
        if 'stage_id' in vals or 'type' in vals:
            referrer = self.env['res.partner'].search([('utm_source_id', '=', self.source_id.id)])
            if not referrer.referrer_rewarded_id:
                old_state = self.get_referral_statuses(referrer, self.partner_id)
                r = super().write(vals)
                new_state = self.get_referral_statuses(referrer, self.partner_id)
                if(STATES_PRIORITY[new_state] > STATES_PRIORITY[old_state]):
                    template = self.env.ref('website_sale_referral.referral_state_changed_email_template', False)
                    template.sudo().with_context({'referred': self.partner_id, 'state': _(new_state)}).send_mail(referrer.id, force_send=True)
                    if(new_state == 'done'):
                        pass  # TODO next activity
            return r
        else:
            return super().write(vals)
