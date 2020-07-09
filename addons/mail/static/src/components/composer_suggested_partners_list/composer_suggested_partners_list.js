odoo.define('mail/static/src/components/composer_suggested_partners_list/composer_suggested_partners_list.js', function (require) {
'use strict';
const { Component } = owl;
const useStore = require('mail/static/src/component_hooks/use_store/use_store.js');
const { useState } = owl.hooks;


const components = {
    ComposerSuggestedPartner: require('mail/static/src/components/composer_suggested_partner/composer_suggested_partner.js'),
};

class ComposerSuggestedPartnersList extends Component {

    constructor(...args) {
        super(...args);
        this.state = useState({
            isShowMore: false
        });

        useStore(props => {
            const thread = this.env.models['mail.thread'].get(props.threadLocalId);
            return {
                thread: thread ? thread.__state : undefined,
            };
        });
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {mail.thread}
     */
    get thread() {
        return this.env.models['mail.thread'].get(this.props.threadLocalId);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onClickShowLess(ev) {
        ev.preventDefault();
        this.state.isShowMore = false;
    }

    _onClickShowMore(ev) {
        ev.preventDefault();
        this.state.isShowMore = true;
    }
}

Object.assign(ComposerSuggestedPartnersList, {
    components,
    defaultProps: {},
    props: {
        threadLocalId: String,
    },
    template: 'mail.ComposerSuggestedPartnersList',
});

return ComposerSuggestedPartnersList;
});
