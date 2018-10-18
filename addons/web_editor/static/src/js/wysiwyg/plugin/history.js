odoo.define('web_editor.wysiwyg.plugin.history', function (require) {
'use strict';

var Plugins = require('web_editor.wysiwyg.plugins');
var registry = require('web_editor.wysiwyg.plugin.registry');

var dom = $.summernote.dom;


var HistoryPlugin = Plugins.history.extend({
    /**
     * clear the history
     *
     */
    clear: function () {
        this.stack = [];
        this.stackOffset = -1;
        this.recordUndo();
    },
});

registry.add('HistoryPlugin', HistoryPlugin);

return HistoryPlugin;

});
