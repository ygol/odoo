odoo.define('website.component.UserValue', function (require) {
'use strict';

const { _t } = require('web.core');

const { useState, useRef } = owl.hooks;
const { xml } = owl.tags;

class UserValue extends owl.Component {
    static template = xml`
        <div class="o_website_user_value">
            <we-row>
                <we-title><t t-esc="props.recordName"/> list</we-title>
                <we-button class="o_we_user_value_widget fa fa-pencil" t-if="!state.isEditing" t-on-click="_onClickEdit" title="Edit"/>
                <we-button class="o_we_user_value_widget fa fa-save" t-if="state.isEditing" t-on-click="_onClickSave" title="Save"/>
            </we-row>
            <!-- SELECTED RECORDS -->
            <div>
                <t t-foreach="state.selectedRecords" t-as="record" t-key="record">
                    <div class="o_we_record_wrapper">
                        <span t-raw="record" class="o_we_record"/>
                        <we-button class="fa fa-minus ml-1" t-if="state.isEditing" t-on-click="_onDeSelectRecord(record)"/>
                    </div>
                </t>
            </div>
            <t t-if="state.isEditing">
                <!-- UNSELECTED RECORDS -->
                <we-select>
                    <we-title>"Existing"</we-title>
                    <t t-foreach="state.unselectedRecords" t-as="record" t-key="record">
                        <we-button t-on-click="_onSelectRecord(record)">
                            <t t-raw="record"/>
                        </we-button>
                    </t>
                </we-select>
                <we-row t-attf-string="New {{props.recordName}}">
                    <input t-ref="newRecordInput" placeholder="Name"/>
                    <we-button title="Confirm" t-on-click="_onAddNewRecord" class="fa fa-plus ml-1"/>
                </we-row>
            </t>
        </div>
    `;
    /**
     * @override
     */
    constructor() {
        super(...arguments);
        this.state = useState({
            isEditing: true,
            selectedRecords: this.props.selectedRecords,
            unselectedRecords: this.props.unselectedRecords,
            newRecords: [],
        });
        this.newRecordInput = useRef("newRecordInput");
        this.editButton = useRef("editButton");
    }

    willUnmount() {
        this._save();
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _save() {
        this.trigger('save-user-value', {
            selectedRecords: this.state.selectedRecords,
            newRecords: this.state.newRecords,
        });
        this.state.isEditing = false;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onAddNewRecord(ev) {
        ev.stopPropagation();
        const newRecord = this.newRecordInput.el.value;
        const allRecords = this.state.selectedRecords.concat(this.state.unselectedRecords).map(record => record.toLowerCase());
        if (allRecords.includes(newRecord.toLowerCase())) {
            return;
        }
        this.state.selectedRecords.push(newRecord)
        this.state.newRecords.push(newRecord)
    }
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickEdit(ev) {
        ev.stopPropagation();
        this.state.isEditing = true;
    }
    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickSave(ev) {
        ev.stopPropagation();
        this._save();

    }
    /**
     * @private
     * @param {String} record
     * @param {MouseEvent} ev
     */
    _onDeSelectRecord(record, ev) {
        ev.stopPropagation();
        this.state.selectedRecords = this.state.selectedRecords.filter(item => item !== record);
        this.state.unselectedRecords.push(record);
    }
    /**
     * @private
     * @param {String} record
     * @param {MouseEvent} ev
     */
    _onSelectRecord(record, ev) {
        ev.stopPropagation();
        this.state.unselectedRecords = this.state.unselectedRecords.filter(item => item !== record);
        this.state.selectedRecords.push(record);
    }
}

UserValue.defaultProps = {
    selectedRecords: [],
    unselectedRecords: [],
    recordName: 'record',
};

UserValue.props = {
    selectedRecords: Array,
    unselectedRecords: Array,
    recordName: String,
};

return UserValue;

});
