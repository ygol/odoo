odoo.define('web_editor.plugins', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var registry = require('web_editor.wysiwyg.plugin.registry');
var wysiwygOptions = require('web_editor.wysiwyg.options');


return _.mapObject(wysiwygOptions.modules, function (Module, pluginName) {
    var prototype = {
        init: function () {
            var events = this.events;
            this._super.apply(this, arguments);
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

});
