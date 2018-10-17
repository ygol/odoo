odoo.define('web_editor.wysiwyg.plugins', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var registry = require('web_editor.wysiwyg.plugin.registry');
var wysiwygOptions = require('web_editor.wysiwyg.options');


var plugins = _.mapObject(wysiwygOptions.modules, function (Module, pluginName) {
    var prototype = {
        init: function () {
            this._super.apply(this, arguments);
            var events = this.events;
            if (!this.avoidDefaultInit) {
                this.summernote.options.modules[pluginName].apply(this, arguments);
                if (events && events !== this.events) {
                    console.error('Odoo event are override by the summernote "' + pluginName + '" init. You can use "avoidDefaultInit" option.');
                }
            }
        },
    };
    _.each(Module.prototype, function (prop, name) {
        if (typeof prop === 'function') {
            prototype[name] = function () {
                return this.summernote.options.modules[pluginName].prototype[name].apply(this, arguments);
            };
        } else {
            prototype[name] = prop;
        }
    });

    var Plugin = AbstractPlugin.extend(prototype).extend({
        destroy: function () {
            if (this.shouldInitialize()) {
                this._super();
            }
        },
    });

    // override summernote default buttons
    registry.add(pluginName, Plugin);

    return Plugin;
});

// export table plugin to convert it in module (see editor)

var $textarea = $('<textarea>');
$('body').append($textarea);
$textarea.summernote();
var summernote = $textarea.data('summernote');

_.each(['style', 'table', 'typing', 'bullet'], function (name) {
    var prototype = {};
    for (var k in summernote.modules.editor[name]) {
        prototype[k] = summernote.modules.editor[name][k];
    }
    plugins[name] = AbstractPlugin.extend(prototype);
});
try {
    $textarea.summernote('destroy');
} catch (e) {
    summernote.layoutInfo.editor.remove();
}
$textarea.remove();


return plugins;

});
