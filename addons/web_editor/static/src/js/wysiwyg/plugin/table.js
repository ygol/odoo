odoo.define('web_editor.wysiwyg.plugin.table', function (require) {
'use strict';

var Plugins = require('web_editor.wysiwyg.plugins');
var registry = require('web_editor.wysiwyg.plugin.registry');

var dom = $.summernote.dom;


var TablePlugin = Plugins.table.extend({
    insertTable: function (dim) {
        var dimension = dim.split('x');
        var table = this.createTable(dimension[0], dimension[1], this.options);
        this.context.invoke('HelperPlugin.insertBlockNode', table);
        var range = this.context.invoke('editor.createRange');
        range.sc = range.ec = $(table).find('td')[0];
        range.so = range.eo = 0;
        range.normalize().select();
        this.context.invoke('editor.saveRange');
    },
    deleteTable: function () {
        var range = this.context.invoke('editor.createRange');
        var cell = dom.ancestor(range.commonAncestor(), dom.isCell);
        var table = $(cell).closest('table')[0];

        var point = this.context.invoke('HelperPlugin.removeBlockNode', table);
        range.sc = range.ec = point.node;
        range.so = range.eo = point.offset;
        range.normalize().select();
    },
});

registry.add('TablePlugin', TablePlugin);

return TablePlugin;

});
