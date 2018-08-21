odoo.define('web_editor.wysiwyg.plugin.editor', function (require) {
'use strict';

var Plugins = require('web_editor.plugins');
var registry = require('web_editor.wysiwyg.plugin.registry');

var NewSummernoteEditor = Plugins.editor.extend({
    init: function () {
        this._super.apply(this, arguments);
        this.insertTable = this.wrapCommand(this._insertTable.bind(this));
        this.insertOrderedList = this.wrapCommand(this._insertOrderedList.bind(this));
        this.insertUnorderedList = this.wrapCommand(this._insertUnorderedList.bind(this));
        this.indent = this.wrapCommand(this._indent.bind(this));
        this.outdent = this.wrapCommand(this._outdent.bind(this));
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * change editor to fix the twice undo (CTRL-Z) with odoo integration
     *
     * @override
     */
    undo: function () {
        this.createRange();
        setTimeout(this._super.bind(this));
    },
    /**
     * hide all popover
     *
     */
    hidePopover: function () {
        this.context.invoke('imageDialog.hidePopover');
        this.context.invoke('LinkPopover.hide');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _indent: function (outdent) {
        return this.context.invoke('TextPlugin.indent', false);
    },
    /**
     * summernote insertOrderedList is buggy when we used with div has parent of
     * a selection
     */
    _insertOrderedList: function () {
        return this.context.invoke('TextPlugin.insertList', true);
    },
    /**
     * Insert table use unbreakable node
     *
     * @param {string} dim (eg: 3x3)
     */
    _insertTable: function (dim) {
        var dimension = dim.split('x');
        var table = this.table.createTable(dimension[0], dimension[1], this.options);
        this.context.invoke('HelperPlugin.insertBlockNode', table);
        var range = this.createRange();
        range.sc = range.ec = $(table).find('td')[0];
        range.so = range.eo = 0;
        range.normalize().select();
        this.saveRange();
    },
    /**
     * summernote insertUnorderedList is buggy when we used with div has parent of
     * a selection
     */
    _insertUnorderedList: function (sorted) {
        return this.context.invoke('TextPlugin.insertList', false);
    },
    _outdent: function () {
        return this.context.invoke('TextPlugin.indent', true);
    },
});

// override summernote default editor
registry.add('editor', NewSummernoteEditor);

return NewSummernoteEditor;

});
