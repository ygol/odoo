odoo.define('mail.component.Dialog', function (require) {
"use strict";

const AttachmentViewer = require('mail.component.AttachmentViewer');

class Dialog extends owl.Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.component.Dialog';
        this._globalClickEventListener = ev => this._onClickGlobal(ev);
    }

    mounted() {
        document.addEventListener('click', this._globalClickEventListener);
    }

    /**
     * @param {Object} nextProps
     * @param {owl.Component} nextProps.Component
     */
    willUpdateProps(nextProps) {
        this.components.Component = nextProps.Component;
    }

    willUnmount() {
        document.removeEventListener('click', this._globalClickEventListener);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        ev.stopPropagation();
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickGlobal(ev) {
        if (ev.target.closest(`.o_Dialog_component[data-dialog-id="${this.props.id}"]`)) {
            return;
        }
        if (!this.refs.component.isCloseable()) { return; }
        this.trigger('o-close', {
            id: this.props.id,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onClose(ev) {
        this.trigger('o-close', {
            id: this.props.id,
        });
    }
}

Dialog.components = {
    /**
     * Since components is static, no longer can define components from props.
     * Dialog only works with attachment viewer for the time being, this will
     * be fixed later...
     */
    Components: AttachmentViewer,
};

Dialog.props = {
    Component: Object,
    id: String,
    info: Object,
};

return Dialog;

});
