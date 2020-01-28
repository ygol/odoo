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
        if(referrer_email.value == "") { //user is not connected
            referrer_email.attr('required','1')
        }
        return this._super.apply(this, arguments);
    },

    onclick_share_social_network: function(ev) {
        this.clean_checks()
        this.onclick_common(ev, function(data) {window.open(data["link"])})
    },

    onclick_get_link: function(ev) {
        this.clean_checks()
        this.onclick_common(ev, function(data) {
            //ELIZABETH1
            //Voir fichiers website_sale_referral/views/referral_template.xml et website_crm_referral/views/referral_template.xml
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
        } else {}
    },

    clean_checks: function() {
        _.each($("input:required"), function(input) {
            $(input).removeClass('bg-danger')
        })
    },

    empty_form: function() {
        $("input[id='referrer_email']")[0].val = ''
    },

    check_form_validity: function(submit_button) {
        var required_empty_input = $("input:required").filter(function(index, item) { return item.value === '' })
        if(required_empty_input.length) {
            //ELIZABETH2 => Il y a 2 endroits ou cette injection peut se produire
            //Voir fichiers website_sale_referral/views/referral_template.xml et website_crm_referral/views/referral_template.xml
            $(submit_button).parent().parent().append("<div class='alert alert-danger alert-dismissable fade show'>" + _('Some required fields are not filled') + "</div>")
            required_empty_input.each(function(index, item) { $(item).addClass('bg-danger') })
        }

        var invalid_email = false
        $("input[type='email']:required").each(function(index, item) {
            var email = item.value
            if(email != '') {
                var atpos = email.indexOf("@");
                var dotpos = email.lastIndexOf(".");
                if (atpos<1 || dotpos<atpos+2 || dotpos+2>=email.length) { //invalid
                    $(item).addClass('bg-danger');
                    if(!invalid_email) {
                        //ELIZABETH2
                        $(submit_button).parent().append("<div class='alert alert-danger alert-dismissable fade show'>" + _('Not a valid e-mail address') + "</div>");
                        invalid_email = true
                    }
                }
            }
        })
        $(".alert").delay(4000).slideUp(200, function() {
            $(this).alert('close');
        });
        return !invalid_email && !required_empty_input.length;
    },

    get_params:function(ev) {
        var params = {}
        params['referrer_email'] = $("input[id='referrer_email']").val()
        params['token'] = $("input[name='token']").val()
        debugger
        params['channel'] = ev.target.closest('button').value
        return params
    },
});

return publicWidget.registry.ReferralWidget;

});
