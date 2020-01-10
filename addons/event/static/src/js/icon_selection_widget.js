odoo.define('event.icon_selection_widget', function (require) {
"use strict";

var core = require('web.core');
var registry = require('web.field_registry');
var AbstractField = require('web.AbstractField');
var QWeb = core.qweb;

var IconSelectionWidget = AbstractField.extend({
    /**
    * @override
    * @private
    */
    _render: function () {
        this._super.apply(this, arguments);
        this.icon = this.nodeOptions[this.value+'-icon'];
        this.title = this.value.charAt(0).toUpperCase() + this.value.slice(1);
        this.$el.html(QWeb.render('event.IconSelectionWidget', {'widget': this}));
    },

});

registry.add('icon_selection_widget', IconSelectionWidget);

return IconSelectionWidget;

});
