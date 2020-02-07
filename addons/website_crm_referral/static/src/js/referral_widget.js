odoo.define('website_crm_referral.referral_widget', function (require) {
    "use strict";



var ReferralWidget = require('website_sale_referral.referral_widget');
var core = require('web.core');
var QWeb = core.qweb;

ReferralWidget.include({
    events: _.extend({}, ReferralWidget.prototype.events, {
        'click #create_lead' : 'onclick_submit'
    }),

    onclick_submit: function(ev) {
        if(this.check_form_validity(ev.target.closest('button')))
        {
            var self = this;
            this.onclick_common(ev, function(data)
            {
                var params = self.get_params(ev);
                self.empty_form();
                self.inject_tracking(params);
            });
        }
    },

    empty_form:function() {
        $("input[name='name']")[0].value = '';
        $("input[name='email']")[0].value = '';
        $("input[name='phone']")[0].value = '';
        $("input[name='company']")[0].value = '';
        $("textarea[name='comment']")[0].value = '';
    },

    get_params:function(ev) {
        var params = this._super.apply(this, arguments);
        params.name = $("input[name='name']").val();
        params.email = $("input[name='email']").val();
        params.phone = $("input[name='phone']").val();
        params.company = $("input[name='company']").val();
        params.comment = $("textarea[name='comment']").val();
        return params;
    },

    inject_tracking: function(params) {
        if(this.is_demo_data) {
            var referrals = {};
            referrals[params.email] = {'name': params.name, 'company': params.company, 'state': 'new'};
            this.render_tracking(referrals);
            this.is_demo_data = false;
        }
        else {
            var rendered_html = QWeb.render('referral_tracking_single_sub_template', {'r':{'name': params.name, 'company': params.company, 'state': 'new'}});
            $("div[id='referral_tracking_sub_template']").append(rendered_html);

            var potential_reward = $("div[id='potential_reward']");
            potential_reward.html(this.reward_value_to_text(++this.referrals_count));

        }
    },

});

});
