from odoo.tests.common import TransactionCase


class TestReferral(TransactionCase):

    def setUp(self, *args, **kwargs):
        result = super().setUp(*args, **kwargs)

        self.Partner = self.env['res.partner']
        referred = self.Partner.create({
            'name': 'Marcel Poinchard',
            'email': 'marcel@example.com',
        })

        self.CrmStages = self.env['crm.stage']
        self.stages_ids = []
        stages_names = ['new', 'qualified', 'won']
        for s in stages_names:
            self.stages_ids.append(self.CrmStages.create({
                'name': s,
                'sequence': stages_names.index(s),
                'is_won': s == 'won',
            }).id)

        self.ReferralCampaign = self.env['website_crm_referral.referral.campaign']
        self.campaign = self.ReferralCampaign.create({
            'name': 'Test Campaign',
            'crm_stages': self.stages_ids,
        })
        self.Referral = self.env['website_crm_referral.referral']
        self.referral = self.Referral.create({
            'user_id': self.env.user.id,
            'referred_id': referred.id,
            'comment': 'A test referral.',
            'channel': 'direct',
            'campaign_id': self.campaign.id,
        })

        return result

    def test_lead(self):
        self.assertFalse(self.referral.lead_id)
        lead = self.referral.create_lead()
        self.assertTrue(self.referral.lead_id)
        self.assertFalse(lead.to_be_rewarded)
        self.assertEqual(lead.stage_id.id, self.stages_ids[0])
        lead.update({'stage_id': self.stages_ids[1]})
        self.assertFalse(lead.to_be_rewarded)
        lead.update({'stage_id': self.stages_ids[2]})
        self.assertTrue(lead.to_be_rewarded)
