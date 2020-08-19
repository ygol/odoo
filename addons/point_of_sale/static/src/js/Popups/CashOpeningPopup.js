odoo.define('point_of_sale.CashOpeningPopup', function(require) {
    'use strict';

    const { useState, useRef} = owl.hooks;
    const PosComponent = require('point_of_sale.PosComponent');
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');


    class CashOpeningPopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            this.cashBoxValue = this.env.pos.bank_statement.balance_start || 0;;
            this.currency = this.env.pos.currency;
            this.state = useState({
                notes: "",
            });
            this.inputRef = useRef('input');
        }

        startSession() {
            this.env.pos.bank_statement.balance_start = parseFloat(this.cashOpening);
            this.env.pos.pos_session.state = 'opened';
            this.rpc({
                    model: 'pos.session',
                    method: 'set_cashbox_pos',
                    args: [this.env.pos.pos_session.id, parseFloat(this.cashOpening), this.state.notes],
                });
            this.trigger('close-popup');
        }

        sendInput(value) {
            if(value !== "Backspace") {
                if(this.cashBoxValue === 0) {
                    this.cashBoxValue = value !== "."? value: this.cashBoxValue + value;
                } else {
                    this.cashBoxValue += value;
                }
            } else {
                if(this.cashBoxValue.length > 1) {
                    this.cashBoxValue = this.cashBoxValue.substring(0, this.cashBoxValue.length -1)
                } else {
                    this.cashBoxValue = 0;
                }
            }
            this.render();
        }

    }

    CashOpeningPopup.template = 'CashOpeningPopup';
    Registries.Component.add(CashOpeningPopup);

    return CashOpeningPopup;
});
