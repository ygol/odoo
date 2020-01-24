odoo.define('website_sale_referral.referral_form', function (require) {
    "use strict";

var publicWidget = require('web.public.widget');
var ajax = require('web.ajax');

publicWidget.registry.ReferralWidget = publicWidget.Widget.extend({
    selector:'.referral_form',
    events: {
        'click .share_social_network': 'onclick_share_social_network',
        'click .get_link' : 'onclick_get_link'
    },

    start: function() {
        var referrer_email = $("input[id='referrer_email']")
        if(referrer_email.length) { //user is not connected
            referrer_email.attr('required','1')
        }
        return this._super.apply(this, arguments);
    },

    onclick_share_social_network: function(ev) {
        this.clean_checks()
        this.onclick_common(ev, [$("input[id='referrer_email']")], function(data) {window.open(data["link"])})
    },

    onclick_get_link: function(ev) {
        this.clean_checks()
        this.onclick_common(ev, function(data) {
            $("#share_link_text").append("<div class='row col-lg-12 text-center alert alert-info'>" + data["link"] + "</div>");
        })
    },

    onclick_common: function(ev, then_func) {
        if(this.check_form_validity(ev.target.closest('button')))
        {
            var self = this
            ajax.jsonRpc('/referral/send', 'call', this.get_params(ev))
            .then(function (data) {
                self.empty_form()
                then_func(data)
            })
        }
    },

    clean_checks: function() {
        _.each($("input:required"), function(input) {
            $(input).removeClass('bg-danger');
        })
    },

    empty_form: function() {
        $("input[id='referrer_email']")[0].val = ''
    },

    check_form_validity: function(submit_button) {
        var required_empty_input = _.find($("input:required"), function(input) {return input.value === ''; });
        if(required_empty_input) {
            $(submit_button).parent().append("<div class='alert alert-danger alert-dismissable fade show'>" + _('Some required fields are not filled') + "</div>");
            _.each($("input:required"), function(input) {
                if (input.value === '') {
                    $(input).addClass('bg-danger');
                }
            });
        }

        var invalid_email = false
        var all_emails = $("input[type='email']:required")
        all_emails.each(function(index) {
            var email_input = $(all_emails[index])
            var email = email_input.val();
            if(email != '') {
                var atpos = email.indexOf("@");
                var dotpos = email.lastIndexOf(".");
                var invalid = atpos<1 || dotpos<atpos+2 || dotpos+2>=email.length;
                if (invalid) {
                    email_input.addClass('bg-danger');
                    if(!invalid_email) {
                        $(submit_button).parent().append("<div class='alert alert-danger alert-dismissable fade show'>" + _('Not a valid e-mail address') + "</div>");
                        //$("section#hr_cs_personal_information")[0].scrollIntoView({block: "end", behavior: "smooth"});
                        invalid_email = true
                    }
                } else {
                    email_input.removeClass('bg-danger');
                }
            }
        })
        $(".alert").delay(4000).slideUp(200, function() {
            $(this).alert('close');
        });
        return !invalid_email && !required_empty_input;
    },

    get_params:function(ev) {
        var params = {}
        params['referrer_email'] = $("input[id='referrer_email']").val()
        params['channel'] = ev.target.closest('button').value
        return params
    },
});

return publicWidget.registry.ReferralWidget;

});
