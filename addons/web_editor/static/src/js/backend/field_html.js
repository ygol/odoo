odoo.define('web_editor.field.html', function (require) {
'use strict';

var ajax = require('web.ajax');
var basic_fields = require('web.basic_fields');
var config = require('web.config');
var core = require('web.core');
var dom = require('web.dom');
var session = require('web.session');
var Wysiwyg = require('web_editor.wysiwyg');
var field_registry = require('web.field_registry');

var TranslatableFieldMixin = basic_fields.TranslatableFieldMixin;

var QWeb = core.qweb;
var _t = core._t;

/**
 * FieldHtml Widget
 * Intended to display HTML content. This widget uses the wysiwyg editor
 * improved by odoo.
 *
 * nodeOptions:
 *  - style-inline => convert class to inline style (no re-edition) => for sending by email
 *  - no-attachment
 *  - cssEdit
 *  - cssReadonly
 *  - snippets
 *  - wrapper
 *
 */
var FieldHtml = basic_fields.DebouncedField.extend(TranslatableFieldMixin, {
    className: 'oe_form_field oe_form_field_html',
    supportedFieldTypes: ['html'],

    custom_events: {
        wysiwyg_focus: '_onWysiwygFocus',
        wysiwyg_blur: '_onWysiwygBlur',
        wysiwyg_change: '_doDebouncedAction',
        wysiwyg_attachment: '_onAttachmentChange',
    },

    /**
     * @override
     */
    willStart: function () {
        this._onUpdateIframeId = 'onLoad_' + _.uniqueId('FieldHtml');
        var defAsset = this.nodeOptions.cssReadonly && ajax.loadAsset(this.nodeOptions.cssReadonly);
        return $.when(this._super().then(Wysiwyg.prepare.bind(Wysiwyg, this)), defAsset);
    },
    /**
     * @override
     */
    destroy: function () {
        delete window.top[this._onUpdateIframeId];
        if (this.$iframe) {
            this.$iframe.remove();
        }
        this._super();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     *
     * @override
     */
    activate: function (options) {
        if (this.wysiwyg) {
            this.wysiwyg.focus();
            return true;
        }
    },
    /**
     * Wysiwyg doesn't notify for changes done in code mode. We override
     * commitChanges to manually switch back to normal mode before committing
     * changes, so that the widget is aware of the changes done in code mode.
     *
     * @override
     */
    commitChanges: function () {
        if (!this.wysiwyg) {
            return this._super();
        }
        if (this.wysiwyg.isDirty()) {
            this._isDirty = true;
        }
        return this.wysiwyg.save().then(this._super.bind(this));
    },
    /**
     * @override
     */
    isSet: function () {
        return this.value && this.value !== "<p><br/></p>" && this.value.match(/\S/);
    },
    /**
     * @override
     */
    getFocusableElement: function () {
        return this.$target || $();
    },
    /**
     * Do not re-render this field if it was the origin of the onchange call.
     *
     * @override
     */
    reset: function (record, event) {
        this._reset(record, event);
        var value = this.value;
        if (this.nodeOptions.wrapper) {
            value = this._wrap(value);
        }
        value = this._textToHtml(value);
        if (!event || event.target !== this) {
            if (this.mode === 'edit') {
                this.wysiwyg.setValue(value);
            } else {
                this.$content.html(value);
            }
        }
        return $.when();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
    _getValue: function () {
        var value = this.$target.val();
        if (this.nodeOptions.wrapper) {
            return this._unWrap(value);
        }
        return value;
    },
    /**
     * create the wysiwyg instance with the target
     * add the editable content: this.$content
     *
     * @private
     * @returns {$.Promise}
     */
    _createWysiwygIntance: function () {
        this.wysiwyg = new Wysiwyg(this, this._getWysiwygOptions());

        // by default it's synchronus because the assets are already loaded in willStart
        // but can be async with option like iframe, snippets...
        return this.wysiwyg.attachTo(this.$target).then(function () {
            this.$content = this.wysiwyg.$el;
            this._onLoadWysiwyg();
        }.bind(this));
    },
    /**
     * get wysiwyg options to create wysiwyg instance
     *
     * @private
     * @returns {Object}
     */
    _getWysiwygOptions: function () {
        return {
            recordInfo: {
                context: this.record.getContext(this.recordParams),
                res_model: this.model,
                res_id: this.res_id,
            },
            noAttachment: this.nodeOptions['no-attachment'],
            inIframe: !!this.nodeOptions.cssEdit,
            iframeCssAssets: this.nodeOptions.cssEdit,
            snippets: this.nodeOptions.snippets,

            tabSize: 0,
            keyMap: {
                pc: {
                    'TAB': null,
                    'SHIFT+TAB': null,
                },
                mac: {
                    'TAB': null,
                    'SHIFT+TAB': null,
                },
            },
        };
    },
    /**
     * trigger_up 'field_changed' add record into the "ir.attachment" field found in the view.
     * This method is called when an image is uploaded by the media dialog.
     *
     * For e.g. when sending email, this allows people to add attachments with the content
     * editor interface and that they appear in the attachment list.
     * The new documents being attached to the email, they will not be erased by the CRON
     * when closing the wizard.
     *
     * @private
     */
    _onAttachmentChange: function (attachments) {
        if (!this.fieldNameAttachment) {
            return;
        }
        this.trigger_up('field_changed', {
            dataPointID: this.dataPointID,
            changes: _.object([this.fieldNameAttachment], [{
                operation: 'ADD_M2M',
                ids: attachments
            }])
        });
    },
    /**
     * @override
     * @private
     */
    _renderEdit: function () {
        var value = this._textToHtml(this.value);
        if (this.nodeOptions.wrapper) {
            value = this._wrap(value);
        }
        this.$target = $('<textarea>').val(value).hide();
        this.$target.appendTo(this.$el);

        var fieldNameAttachment =_.chain(this.recordData)
            .pairs()
            .find(function (value) {
                return _.isObject(value[1]) && value[1].model === "ir.attachment";
            })
            .first()
            .value();
        if (fieldNameAttachment) {
            this.fieldNameAttachment = fieldNameAttachment;
        }

        if (this.nodeOptions.cssEdit) {
            // must be async because the target must be append in the DOM
            this._createWysiwygIntance();
        } else {
            return this._createWysiwygIntance();
        }
    },
    /**
     * @override
     * @private
     */
    _renderReadonly: function () {
        var value = this._textToHtml(this.value);
        if (this.nodeOptions.wrapper) {
            value = this._wrap(value);
        }

        this.$el.empty();

        if (this.nodeOptions.cssReadonly) {
            this.$iframe = $('<iframe class="o_readonly"/>');
            this.$iframe.appendTo(this.$el);

            // inject content in iframe

            var def = $.Deferred();
            this.$iframe.data('load-def', def); // for unit test
            window.top[this._onUpdateIframeId] = def.resolve;

            this.$iframe.one('load', function onLoad () {
                ajax.loadAsset(this.nodeOptions.cssReadonly).then(function (asset) {
                    var cwindow = this.$iframe[0].contentWindow;
                    cwindow.document
                        .open("text/html", "replace")
                        .write(
                            '<head>' +
                                '<meta charset="utf-8"/>' +
                                '<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1"/>\n' +
                                '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>\n' +
                                _.map(asset.cssLibs, function (cssLib) {
                                    return '<link type="text/css" rel="stylesheet" href="' + cssLib + '"/>';
                                }).join('\n') + '\n' +
                                _.map(asset.cssContents, function (cssContent) {
                                    return '<style type="text/css">' + cssContent + '</style>';
                                }).join('\n') + '\n' +
                            '</head>\n' +
                            '<body class="o_in_iframe o_readonly">\n' +
                                '<div id="iframe_target">' + value + '</div>\n' +
                                '<script type="text/javascript">' +
                                    'if (window.top.' + this._onUpdateIframeId + ') {' +
                                        'window.top.' + this._onUpdateIframeId + '()' +
                                    '}' +
                                '</script>\n' +
                            '</body>');

                    var height = cwindow.document.body.scrollHeight;
                    this.$iframe.css('height', Math.max(30, Math.min(height, 500)) + 'px');
                }.bind(this));
            }.bind(this));
        } else {
            this.$content = $('<div class="o_readonly"/>').html(value);
            this.$content.appendTo(this.$el);
        }
    },
    /**
     * @private
     * @param {string} text
     * @returns {string} the text converted to html
     */
    _textToHtml: function (text) {
        var value = text || "";
        try {
            $(text)[0].innerHTML; // crashes if text isn't html
        } catch (e) {
            if (value.match(/^\s*$/)) {
                value = '<p><br/></p>';
            } else {
                value = "<p>" + value.split(/<br\/?>/).join("<br/></p><p>") + "</p>";
                value = value
                            .replace(/<p><\/p>/g, '')
                            .replace('<p><p>', '<p>')
                            .replace('<p><p ', '<p ')
                            .replace('</p></p>', '</p>');
            }
        }
        return value;
    },
    /**
     * remove the wrap from the content
     *
     * @private
     * @param {string} html content
     * @returns {string} html content
     */
    _unWrap: function (html) {
        var $wrapper = $(html).find('#wrapper');
        return $wrapper.length ? $wrapper.html() : html;
    },
    /**
     * wrap the content to create a custom display
     *
     * The wrapper must be a static xml template who content id="wrapper" where
     * the content will be include
     *
     * @private
     * @param {string} html content
     * @returns {string} html content
     */
    _wrap: function (html) {
        return $(QWeb.render(this.nodeOptions.wrapper))
            .find('#wrapper').html(html)
            .end().prop('outerHTML');
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     * method called when the wysiwyg instance is loaded
     *
     * @private
     */
    _onLoadWysiwyg: function () {
        var $button = this._renderTranslateButton();
        $button.css({
            'font-size': '15px',
            position: 'absolute',
            right: '+5px',
        });
        var $toolbar = this.$content.closest('.note-editor').find('.note-toolbar');
        $toolbar.css('position', 'relative');
        $toolbar.append($button);
    },
    /**
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onWysiwygBlur: function (ev) {
        ev.stopPropagation();
        this._doAction();
        if (ev.data.key === 'TAB') {
            this.trigger_up('navigation_move', {direction: ev.data.shiftKey ? 'left' : 'right'});
        }
    },
    /**
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onWysiwygFocus: function (ev) {
    },
});


field_registry.add('html', FieldHtml);


return FieldHtml;
});
