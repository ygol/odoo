odoo.define('mail/static/src/components/composer_suggested_partner/composer_suggested_partner.js', function (require) {
'use strict';
const { Component } = owl;
const useStore = require('mail/static/src/component_hooks/use_store/use_store.js');
// const { useState } = owl.hooks;

class ComposerSuggestedPartner extends Component {

    constructor(...args) {
        super(...args);
        // this.state = useState({});

        useStore(props => {
            const suggestedPartner = this.env.models['mail.suggested_partner'].get(props.suggestedPartnerLocalId);
            return {
                suggestedPartner: suggestedPartner ? suggestedPartner.__state : undefined,
            };
        });
    }

    get suggestedPartner() {
        return this.env.models['mail.suggested_partner'].get(this.props.suggestedPartnerLocalId);
    }

    _onChangeSuggestedPartner() {
        this.suggestedPartner.update({
            checked: !this.suggestedPartner.checked
        });
    }
}

Object.assign(ComposerSuggestedPartner, {
    defaultProps: {},
    props: {
        suggestedPartnerLocalId: String
    },
    template: 'mail.ComposerSuggestedPartner',
});

return ComposerSuggestedPartner;
});
