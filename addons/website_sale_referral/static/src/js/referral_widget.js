odoo.define('website_sale_referral.referral_widget', function (require) {
    "use strict";

var publicWidget = require('web.public.widget');
var ajax = require('web.ajax');
var core = require('web.core');
var QWeb = core.qweb;

publicWidget.registry.ReferralWidget = publicWidget.Widget.extend({
    xmlDependencies: ['/website_sale_referral/static/src/xml/referral_tracking_sub_template.xml'],
    selector:'.referral_widget',
    events: {
        'click .share_social_network': 'onclick_share_social_network',
        'click .get_link' : 'onclick_get_link',
    },

    start: function() {
        this.load_tracking();
        return this._super.apply(this, arguments);
    },

    load_tracking: function() {
        var token = $("input[name='referral_token']").val();
        var url = token ? '/referral/tracking/'.concat(token) : '/referral/tracking/';
        var self = this;
        ajax.jsonRpc(url, 'call', {})
        .then(function (data) {
            self.currency_symbol = data.currency_symbol;
            self.currency_position = data.currency_position;
            self.reward_value = data.reward_value;
            var referrals = 'my_referrals' in data ? data.my_referrals : {};
            self.render_tracking(referrals);
        });
    },

    render_tracking: function(data) {
        var referrals = data;
        this.is_demo_data = false;
        if(Object.keys(referrals).length == 0) {
            referrals = this.get_example_referral_statuses();
            this.currency_symbol = '$';
            this.currency_position = 'before';
            this.reward_value = 200;
            this.is_demo_data = true;
        }
        this.referrals_count = Object.keys(referrals).length;
        this.referrals_won = 0;
        var r;
        for(r in referrals) {
            if(referrals[r].state == 'done') {
                this.referrals_won++;
            }
        }
        var context = {
            'my_referrals': referrals,
            'reward_value': this.reward_value,
            'total_reward': this.reward_value_to_text(this.referrals_won),
            'potential_reward': this.reward_value_to_text(this.referrals_count - this.referrals_won)
        };
        var rendered_html = QWeb.render('referral_tracking_sub_template', context);
        if(this.is_demo_data) {
            rendered_html = "<div class='o_sample_overlay bg-white'/>".concat(rendered_html);
        }
        $("div[id='referral_tracking_sub_template']").html(rendered_html);
    },

    reward_value_to_text: function(quantity) {
        if(this.currency_position == 'after') {
            return (quantity * this.reward_value).toString().concat(this.currency_symbol);
        }
        else {
            return this.currency_symbol.concat((quantity * this.reward_value).toString());
        }
    },

    get_example_referral_statuses: function() {
    //This is not demo data, this is a dummy to show as an example on the referral register page
        return {
            'julie@example.com': {
                'state': 'in_progress',
                'name': 'Julie Richards',
                'company': 'Ready Mat',
            },
            'brandon@example.com': {
                'state': 'new',
                'name': 'Brandon Freeman',
                'company': 'Azure Interior',
            },
            'collen@example.com': {
                'state': 'in_progress',
                'name': 'Colleen Diaz',
                'company': 'Azure Interior',
            },
            'kevin@example.com': {
                'state': 'done',
                'name': 'Kevin Leblanc',
                'company': 'Azure Interior',
            },
            'lucille@example.com': {
                'state': 'cancel',
                'name': 'Lucille Camarero',
                'company': 'Ready Mat',
            }
        };
    },


    onclick_share_social_network: function(ev) {
        this.onclick_common(ev, function(data)
        {
            window.open(data.link);
        });
    },

    onclick_get_link: function(ev) {
        this.onclick_common(ev, function(data) {
            var input = $("input[id='copy_link_input']")[0], btn = $("#copy-link");
            btn.html("<i class='fa fa-lg fa-check pr-2' role='img'/>Link Copied");
            btn.addClass("bg-primary");
            btn.removeClass("bg-700");
            input.value = data.link;
            input.select();
            document.execCommand("copy");
        });
    },

    onclick_common: function(ev, then_func) {
        ajax.jsonRpc('/referral/send', 'call', this.get_params(ev))
        .then(function (data) {
            then_func(data);
        });
    },

    check_form_validity: function(submit_button) {
        var required_empty_input = $("input:required").filter(function(index, item) { return item.value === ''; });
        if(required_empty_input) {
            required_empty_input.each(function(index, item) { $(item).addClass('is-invalid'); });
        }
        var required_filled_input = $("input:required").filter(function(index, item) { return item.value != ''; });
        if(required_filled_input) {
            required_filled_input.each(function(index, item) { $(item).removeClass('is-invalid'); });
        }

        var invalid_email = false;
        $("input[type='email']:required").each(function(index, item) {
            var email = item.value;
            if(email != '') {
                var atpos = email.indexOf("@");
                var dotpos = email.lastIndexOf(".");
                if (atpos<1 || dotpos<atpos+2 || dotpos+2>=email.length) { //invalid
                    $(item).addClass('is-invalid');
                    invalid_email = true;
                }
                else {
                    $(item).removeClass('is-invalid');
                }
            }
        });

        return !invalid_email && !required_empty_input.length;
    },

    get_params:function(ev) {
        var params = {};
        params.token = $("input[name='referral_token']").val();
        params.channel = ev.target.closest('button').value;
        return params;
    },
});

return publicWidget.registry.ReferralWidget;

});
