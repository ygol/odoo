odoo.define('account.StarredBillWidget', function (require) {
    "use strict";

    var FieldMany2One = require('web.relational_fields').FieldMany2One;
    var core = require('web.core');
    const registry = require('web.field_registry');
    
    var _t = core._t;
    
    /**
     * Override of FieldPhone to use add a button calling SMS composer if option activated
     */
    
    var StarredBillWidget = FieldMany2One.extend({
        resetOnAnyFieldChange: true,
    
        _modifyAutocompleteRendering: function (){
            var api = this.$input.data('ui-autocomplete');
            if(api._superRenderEdit)
                return;
            api._superRenderEdit = api._renderItem;
            var self = this;
            api._renderItem = function(ul,item) {
                return self._customRenderItem(ul,item,api);
            }
                
            // api._renderItem = function(ul, item){
            //     ul.addClass('o_partner_autocomplete_dropdown');
            //     var $a = $('<a/>')["html"](item.label);
            //     var $star = $('<span/>')
            //     $star.addClass('fa fa-star');
            //     if (item.logo){
            //         var $img = $('<img/>').attr('src', item.logo);
            //         $a.append($img);
            //     }
            //     var /*return*/ res =  $("<li></li>")
            //         .data("item.autocomplete",item)
            //         .append($a)
            //         .append($star)
            //         .appendTo(ul)
            //         .addClass(item.classname);
            //         console.log('>>>',item, res);
            //     return res;
            // };
        },
        // _renderMenu: function( ul, item ){
        //     res = this._super.apply(this, arguments);
        //     console.log('MENU',res,this);
        //     return res;
        // },
        // _renderItem : function(){
        //     res = this._super.apply(this, arguments);
        //     console.log('ITEM',res,this);
        //     return res;
        // },
        _customRenderItem:function(ul,item,api){
            
            var res = api._superRenderEdit(ul,item);
            if(this.recordData.partner_id)
            {
                console.log('->>',this.recordData)
                res.append($('<span/>').addClass('fa fa-star'));
            }
            // console.log('plop',this.recordData.partner_id, res);
            return res;
        },
        // _onInputClick: function () {
        //     console.log('I CLICK', this, this.recordData.partner_id);
        //     if (this.$input.autocomplete("widget").is(":visible")) {
        //         this.$input.autocomplete("close");
        //     } else if (this.floating) {
        //         this.$input.autocomplete("search"); // search with the input's content
        //     } else {
        //         this.$input.autocomplete("search", ''); // search with the empty string
        //     }
        // },
        /**
         * @override
         * @private
         */
        _renderEdit: function (){
            // this.m2o_value = this._getDisplayNameWithoutVAT(this.m2o_value);
            this._super.apply(this, arguments);
            // console.log('RENDER EDIT',this,this.m20_value);
            
            this._modifyAutocompleteRendering();
        },
        // events: _.extend({}, FieldMany2One.prototype.events, {
        //     'click ui-menu-item': '_onUIMenuItemClick',
        //     // 'change select': '_onSelectionChange',
        // }),
        // _onUIMenuItemClick: function(event){
        //     console.log('click',event,this)
        // },
        // init: function () {
        //     this._super.apply(this, arguments);
        //     console.log('ok widget !',this)
        // },
        // _renderReadonly: function () {
        //     var def = this._super.apply(this, arguments);   
        //     console.log(">>>",this);
        //     return def
        // },
        /**
         * @private
         * @override
         */
        // _render: function () {
        //     var res = this._super.apply(this, arguments);
        //     console.log('RENDER 1',this)
        //     return res;
        //     // var self = this;
        //     // return this._super.apply(this, arguments).then(function () {
        //     //     console.log('RENDER THEN',self)
        //     // });
        // },
        /**
         * Add a button to call the composer wizard
         *
         * @override
         * @private
         */
        /*
        _renderReadonly: function () {
            var def = this._super.apply(this, arguments);            
            if (this.recordData.partner_mobile_is_sane === false) {
                // title 
                var _title = _t('This number is not valid.');
                if(this.recordData.actual_mobile_number_used)
                    _title += ' ' + _t('SMS will be send to') + ' ' + this.recordData.actual_mobile_number_used;
                // button
                var $composerButton = $('<span>', {
                    title: _title,
                    class: 'ml-3 d-inline-flex align-items-center o_partner_phone_warn fa fa-exclamation-triangle'
                });

                if(this.$el[0].nodeName == "DIV")
                    this.$el.append($composerButton);
                else
                    this.$el = $('<div/>').append(this.$el).append($composerButton);
            }
    
            return def;
        },
        */
    });
    
    registry.add('starred_bill_widget', StarredBillWidget);
    return StarredBillWidget;
    
});
    