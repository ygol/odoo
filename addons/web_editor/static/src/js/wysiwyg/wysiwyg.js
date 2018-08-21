odoo.define('web_editor.wysiwyg', function (require) {
'use strict';

var Widget = require('web.Widget');
var config = require('web.config');
var core = require('web.core');
var session = require('web.session');
var ServicesMixin = require('web.ServicesMixin');
var mixins = require('web.mixins');
var modulesRegistry = require('web_editor.wysiwyg.plugin.registry');
var wysiwygOptions = require('web_editor.wysiwyg.options');

var QWeb = core.qweb;
var _t = core._t;

var Wysiwyg = Widget.extend({
    xmlDependencies: [
        '/web_editor/static/src/xml/wysiwyg.xml',
    ],
    custom_events: {
        getRecordInfo:  '_onGetRecordInfo',
        wysiwyg_blur: '_onWysiwygBlur',
    },
    /*
     *
     * init options 'recordInfo':
     *   - context
     *   - [res_model]
     *   - [res_id]
     *   - [data_res_model]
     *   - [data_res_id]
     *   @see _onGetRecordInfo
     *   @see summernote/widgets.js '_getAttachmentsDomain'
     *
     **/
    init: function (parent, options) {
        this._super.apply(this, arguments);
        this.options = options || {};
        this.attachments = this.options.attachments || [];
        this.hints = [];
        this.$el = null;
        this._dirty = false;
        this.id = _.uniqueId('wysiwyg_');
    },
    /*
     * Load assets and color picker template then call summernote API
     * and replace $el by the summernote editable node
     *
     * @override
     **/
    willStart: function () {
        this.$target = this.$el;
        this.$el = null; // temporary null to avoid hidden error, setElement when start
        return this._super()
            .then(function () {
                return modulesRegistry.start(this).then(function () {
                    return this._loadInstance();
                }.bind(this));
            }.bind(this));
    },
    /**
     * start in sync
     * @override
     */
    start: function () {
        this._value = this._summernote.code();
    },
    /**
     * @override
     */
    destroy: function () {
        if (this._summernote) {
            // prevents the replacement of the target by the content of summernote
            // (in order to be able to cancel)
            var removeLayout = $.summernote.ui.removeLayout;
            $.summernote.ui.removeLayout = function ($note, layoutInfo) {
                layoutInfo.editor.remove();
                $note.show();
            };
            this._summernote.destroy();
            $.summernote.ui.removeLayout = removeLayout;
        }
        this.$target.removeAttr('data-wysiwyg-id');
        this.$target.removeData('wysiwyg');
        $(document).off('.' + this.id);
        this._super();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /*
     * undo or redo the editor
     *
     * @param {integer} step
     */
    history: function (step) {
        if (step < 0) {
            while(step) {
                this._summernote.modules.editor.history.rewind();
                step++;
            }
        } else if (step > 0) {
            while(step) {
                this._summernote.modules.editor.history.redo();
                step--;
            }
        }
    },
    /*
     * add a step (undo) in editor
     *
     */
    addHistoryStep: function () {
        var editor = this._summernote.modules.editor;
        editor.createRange();
        editor.history.recordUndo();
    },
    /*
     * save the content in the target
     *      - in init option beforeSave
     *          - receive editable jQuery DOM as attribute
     *          - called after deactivate codeview if needed
     * @returns {$.Promise}
     *      - resolve with true if the content was dirty
     */
    save: function () {
        var isDirty = this.isDirty();
        var html = this.getValue();
        if (this.$target.is('textarea')) {
            this.$target.val(html);
        } else {
            this.$target.html(html);
        }
        return $.when(isDirty, html);
    },
    /*
     * returns true if the content has changed
     *
     * @returns {boolean}
     */
    isDirty: function () {
        if (!this._dirty && this._value !== this._summernote.code()) console.warn("not dirty flag ? Please fix it.");
        return this._value !== this._summernote.code();
    },
    /*
     * return true if the current node is unbreakable.
     * An unbreakable node can be removed, added but can't by split into
     * différent nodes (for keypress and selection).
     * An unbreakable node can contain nodes that can be edited.
     *
     * @param {DOM} node
     * @returns {Boolean}
     */
    isUnbreakableNode: function (node) {
        return !this.isEditableNode(node.parentNode) || !this.isEditableNode(node) || $.summernote.dom.isMedia(node);
    },
    /*
     * return true if the current node is editable (for keypress and selection)
     *
     * @param {DOM} node
     * @returns {Boolean}
     */
    isEditableNode: function (node) {
        return $(node).is(':o_editable') && !$(node).is('table, thead, tbody, tfoot, tr');
    },
    /*
     * return the editable area
     *
     * @returns {jQuery}
     */
    getEditable: function () {
        if (this._summernote.invoke('codeview.isActivated')) {
            this._summernote.invoke('codeview.deactivate');
        }
        return this._summernote.layoutInfo.editable;
    },
    /*
     *
     * @returns {string}
     */
    getValue: function (value) {
        this._summernote.invoke('editor.hidePopover');
        var $editable = this.getEditable().clone();
        $editable.find('[contenteditable]').removeAttr('contenteditable');
        $editable.find('[class=""]').removeAttr('class');
        return $editable.html();
    },
    /*
     *
     * @param {string}
     * @returns {string}
     */
    setValue: function (value) {
        this._dirty = true;
        this._summernote.invoke('editor.hidePopover');
        this.getEditable().html(value + '').change();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @returns {Object} the summernote configuration
     */
    _editorOptions: function () {
        var self = this;
        var allowAttachment = !this.options.noAttachment;

        var options = JSON.parse(JSON.stringify(wysiwygOptions));

        options.parent = this;
        options.lang = "odoo";

        options.focus = false;
        options.disableDragAndDrop = !allowAttachment;
        options.styleTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'];
        options.fontSizes = [_t('Default'), '8', '9', '10', '11', '12', '14', '18', '24', '36', '48', '62'];
        options.minHeight = 180;

        options.keyMap.pc['CTRL+K'] = 'LinkPlugin.show';
        options.keyMap.mac['CMD+K'] = 'LinkPlugin.show';

        options.toolbar = [
            ['style', ['style']],
            ['font', ['bold', 'italic', 'underline', 'clear']],
            ['fontsize', ['fontsize']],
            ['color', ['colorpicker']],
            ['para', ['ul', 'ol', 'paragraph']],
            ['table', ['table']],
            ['insert', allowAttachment ? ['linkPlugin', 'mediaPlugin'] : ['linkPlugin']],
            ['history', ['undo', 'redo']],
            ['view', config.debug ? ['fullscreen', 'codeview', 'help'] : ['fullscreen', 'help']]
        ];
        options.popover = {
            image: [
                ['padding'],
                ['imagesize', ['imageSizeAuto', 'imageSize100', 'imageSize50', 'imageSize25']],
                ['float', ['alignLeft', 'alignCenter', 'alignRight', 'alignNone']],
                ['imageShape'],
                ['cropImage'],
                ['media', ['mediaPlugin', 'removeMedia']],
                ['alt']
            ],
            video: [
                ['padding'],
                ['imagesize', ['imageSize100', 'imageSize50', 'imageSize25']],
                ['float', ['alignLeft', 'alignCenter', 'alignRight', 'alignNone']],
                ['media', ['mediaPlugin', 'removeMedia']]
            ],
            icon: [
                ['padding'],
                ['faSize'],
                ['float', ['alignLeft', 'alignCenter', 'alignRight', 'alignNone']],
                ['faSpin'],
                ['media', ['mediaPlugin', 'removeMedia']]
            ],
            document: [
                ['float', ['alignLeft', 'alignCenter', 'alignRight', 'alignNone']],
                ['media', ['mediaPlugin', 'removeMedia']]
            ],
            link: [
                ['link', ['linkPlugin', 'unlink']]
            ],
            table: [
                ['add', ['addRowDown', 'addRowUp', 'addColLeft', 'addColRight']],
                ['delete', ['deleteRow', 'deleteCol', 'deleteTable']]
            ],
        };

        options.hint = {
            match: /\B@(\w+)$/,
            search: function (keyword, callback) {
                self._rpc({
                    model: 'res.partner',
                    method: "search_read",
                    fields: ['id', 'name', 'email'],
                    domain: [['name', 'ilike', keyword]],
                    limit: 10,
                }).then(callback);
            },
            template: function (partner) {
                return partner.name + (partner.email ? ' <i style="color: #999;">(' + partner.email + ')</i>' : '');
            },
            content: function (item) {
                if (!_.findWhere(self.hints, {id: item.id})) {
                    self.hints.push(item);
                }
                return '@' + item.name + String.fromCharCode(160);
            },
        };

        options.callbacks = {
            onBlur: this._onBlurEditable.bind(this),
            onFocus: this._onFocusEditable.bind(this),
            onChange: this._onChange.bind(this),
            onImageUpload: this._onImageUpload.bind(this),
            onFocusnode: this._onFocusnode.bind(this),
        };

        options.isUnbreakableNode = function (node) {
            node = node && (node.tagName ? node : node.parentNode);
            if (!node) {
                return true;
            }
            return self.isUnbreakableNode(node);
        };
        options.isEditableNode = function (node) {
            node = node && (node.tagName ? node : node.parentNode);
            if (!node) {
                return false;
            }
            return self.isEditableNode(node);
        };
        options.hasFocus = function () {
            return self._isFocused;
        };

        if (this.options.generateOptions) {
            this.options.generateOptions(options);
        }

        return options;
    },
    /**
     * @private
     * @returns {Object} modules list to load
     */
    _getPlugins: function () {
        return _.extend({}, wysiwygOptions.modules, modulesRegistry.plugins());
    },
    /**
     * @returns object who describe the linked record
     *      res_id, res_model, xpath
     *
     * @param {Object} options
     * @returns {Object}
     */
    _getRecordInfo: function (options) {
        var data = this.options.recordInfo || {};
        if (typeof data === 'function') {
            data = data(options);
        }
        if (!data.context) {
            console.warn('Context is missing');
        }
        return data;
    },
    /**
     * check if the given node is in the editor (eg: a button in the MediaDialog return true)
     *
     * @returns {boolean}
     */
    _isEditorContent: function (node) {
        if (this.el === node) {
            return true;
        }
        if ($.contains(this.el, node)) {
            return true;
        }

        var children = this.getChildren();
        var allChildren = [];
        var child;
        while (child = children.pop()) {
           allChildren.push(child);
           children = children.concat(child.getChildren());
        }

        var childrenDom = _.filter(_.unique(_.flatten(_.map(allChildren, function (obj) {
            return _.map(obj, function (value) {
                return value instanceof $ ? value.get() : value;
            });
        }))), function (node) {
            return node && node.DOCUMENT_NODE && node.tagName && node.tagName !== 'BODY' && node.tagName !== 'HTML';
        });
        return !!$(node).closest(childrenDom).length;
    },
    /**
     * create an instance with the API lib
     *
     * @returns {$.Promise}
     */
    _loadInstance: function () {
        var defaultOptions = this._editorOptions();
        var summernoteOptions = _.extend({}, defaultOptions, _.omit(this.options, 'isEditableNode', 'isUnbreakableNode'));

        _.extend(summernoteOptions.callbacks, defaultOptions.callbacks, this.options.callbacks);
        if (this.options.keyMap) {
            _.defaults(summernoteOptions.keyMap.pc, defaultOptions.keyMap.pc);
            _.each(summernoteOptions.keyMap.pc, function(v, k, o) {
                if(!v) {
                    delete o[k];
                }
            });
            _.defaults(summernoteOptions.keyMap.mac, defaultOptions.keyMap.mac);
            _.each(summernoteOptions.keyMap.mac, function(v, k, o) {
                if(!v) {
                    delete o[k];
                }
            });
        }

        var plugins = _.extend(this._getPlugins(), this.options.plugins);
        summernoteOptions.modules = _.omit(plugins, function (v) {return !v;});

        if (!this.$target.parent().length) {
            summernoteOptions.container = this.$target.parent().css('position', 'relative')[0];
        } else {
            summernoteOptions.container = this.$target[0].ownerDocument.body;
        }

        this.$target.summernote(summernoteOptions);

        this._summernote = this.$target.data('summernote');
        this.$target.attr('data-wysiwyg-id', this.id).data('wysiwyg', this);
        $('.note-editor, .note-popover').not('[data-wysiwyg-id]').attr('data-wysiwyg-id', this.id);

        this.setElement(this._summernote.layoutInfo.editor);
        $(document).on('mousedown.' + this.id, this._onMouseDown.bind(this));
        $(document).on('mouseenter.' + this.id, '*', this._onMouseEnter.bind(this));
        $(document).on('mouseleave.' + this.id, '*', this._onMouseLeave.bind(this));
        $(document).on('mousemove.' + this.id, this._onMouseMove.bind(this));

        this.$el.removeClass('card');

        var def = $.Deferred();
        // summernote invokes handlers after a setTimeout, so we must wait as well
        // before destroying the widget (otherwise we'll have a crash later on)
        setTimeout(def.resolve.bind(def));
        return $.when();
    },
    /**
     * trigger_up 'wysiwyg_focus'
     *
     * @private
     * @param {Object} [options]
     */
    _onFocus: function (options) {
        this.trigger_up('wysiwyg_focus', options);
    },
    /**
     * trigger_up 'wysiwyg_blur'
     *
     * @private
     * @param {Object} [options]
     */
    _onBlur: function (options) {
        this.trigger_up('wysiwyg_blur', options);
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     *
     * @private
     * @param {jQueryEvent}
     */
    _onMouseEnter: function (ev) {
        if (this._isFocused && !this._mouseInEditor && this._isEditorContent(ev.target)) {
            this._mouseInEditor = true;
        }
    },
    /**
     *
     * @private
     * @param {jQueryEvent}
     */
    _onMouseLeave: function (ev) {
        if (this._isFocused && this._mouseInEditor) {
            this._mouseInEditor = null;
        }
    },
    /**
     *
     * @private
     * @param {jQueryEvent}
     */
    _onMouseMove: function (ev) {
        if (this._mouseInEditor === null) {
            this._mouseInEditor = !!this._isEditorContent(ev.target);
        }
    },
    /**
     *
     * @private
     * @param {jQueryEvent}
     */
    _onMouseDown: function (ev) {
        if (this._isEditorContent(ev.target)) {
            setTimeout(function () {
                if (!this._editableHasFocus && !this._isEditorContent(document.activeElement)) {
                    this._summernote.layoutInfo.editable.focus();
                }
                if (!this._isFocused) {
                    this._isFocused = true;
                    this._onFocus();
                }
            }.bind(this));
        } else if (this._isFocused) {
            this._isFocused = false;
            this._onBlur();
        }
    },
    /**
     *
     * @private
     * @param {jQueryEvent}
     */
    _onBlurEditable: function (ev) {
        var self = this;
        this._editableHasFocus = false;
        if (!this._isFocused) {
            return;
        }
        if (!this._justFocused && !this._mouseInEditor) {
            if (this._isFocused) {
                this._isFocused = false;
                this._onBlur();
            }
        } else if (!this._forceEditableFocus) {
            this._forceEditableFocus = true;
            setTimeout(function () {
                if (!self._isEditorContent(document.activeElement)) {
                    self._summernote.layoutInfo.editable.focus();
                }
                self._forceEditableFocus = false; // prevent stack size exceeded.
            });
        } else {
            this._mouseInEditor = null;
        }
    },
    /**
     *
     * @private
     * @param {OdooEvent}
     */
    _onWysiwygBlur: function (ev) {
        if (ev.target === this) {
            return;
        }
        ev.stopPropagation();
        this._isFocused = false;
        this._forceEditableFocus = false;
        this._mouseInEditor = false;
        this._summernote.disable();
        var $target = this.$target.focus();
        setTimeout(this._summernote.enable.bind(this._summernote));
        this._onBlur(ev.data);
    },
    /**
     *
     * @private
     * @param {jQueryEvent}
     */
    _onFocusEditable: function (ev) {
        var self = this;
        this._editableHasFocus = true;
        this._justFocused = true;
        setTimeout(function () {
            self._justFocused = true;
        });
    },
    /**
     * trigger_up 'wysiwyg_change'
     *
     * @private
     */
    _onChange: function () {
        var html = this._summernote.code();
        if (this.hints.length) {
            var hints = [];
            _.each(this.hints, function (hint) {
                if (html.indexOf('@' + hint.name) !== -1) {
                    hints.push(hint);
                }
            });
            this.hints = hints;
        }

        this._dirty = true;
        this.trigger_up('wysiwyg_change', {
            html: html,
            hints: this.hints,
            attachments: this.attachments,
        });
    },
    /**
     * trigger_up 'wysiwyg_attachment' when add an image found in the view.
     *
     * This method is called when an image is uploaded by the media dialog and return the
     * objact attachment from added as record in the "ir.attachment".
     *
     * For e.g. when sending email, this allows people to add attachments with the content
     * editor interface and that they appear in the attachment list.
     * The new documents being attached to the email, they will not be erased by the CRON
     * when closing the wizard.
     *
     * @private
     */
    _onImageUpload: function (attachments) {
        var self = this;
        attachments = _.filter(attachments, function (attachment) {
            return !_.findWhere(self.attachments, {id: attachment.id});
        });
        if (!attachments.length) {
            return;
        }
        this.attachments = this.attachments.concat(attachments);

        // todo remove image not in the view

        this.trigger_up.bind(this, 'wysiwyg_attachment', this.attachments);
    },
    /**
     * Called when the carret focus an other node (focus event, mouse event, or key arrow event)
     * from Unbreakable
     *
     * @param {Object} node DOM
     */
    _onFocusnode: function (node) {},
    /**
     * do not override
     *
     * @see _getRecordInfo
     * @param {OdooEvent} ev
     * @param {Object} ev.data
     * @param {Object} ev.data.recordInfo
     */
    _onGetRecordInfo: function (ev) {
        var data = this._getRecordInfo(ev.data);
        data.attachmentIDs = _.pluck(this.attachments, 'id');
        data.user_id = session.uid || session.user_id;
        _.defaults(ev.data.recordInfo, data);
    },
});

//--------------------------------------------------------------------------
// Public helper
//--------------------------------------------------------------------------

/**
 * Load wysiwyg assets if needed
 *
 * @see Wysiwyg.createReadyFunction
 * @param {Widget} parent
 * @returns {$.Promise}
*/
Wysiwyg.prepare = (function () {
    var assetsLoaded = false;
    var def;
    return function prepare (parent) {
        if (assetsLoaded) {
            return $.when();
        }
        if (def) {
            return def;
        }
        def = $.Deferred();
        var timeout = setTimeout(function () {
            throw _t("Can't load assets of the wysiwyg editor");
        }, 10000);
        var wysiwyg = new Wysiwyg(parent, {recordInfo: {context: {}}});
        wysiwyg.attachTo($('<textarea>')).then(function () {
            assetsLoaded = true;
            clearTimeout(timeout);
            wysiwyg.destroy();
            def.resolve();
        });
        return def;
    };
})();
/**
 *
 * @param {DOM node} DOM (editable or node inside)
 * @returns {Object}
 * @returns {Node} sc - start container
 * @returns {Number} so - start offset
 * @returns {Node} ec - end container
 * @returns {Number} eo - end offset
*/
Wysiwyg.getRange = function (DOM) {
    var range = $.summernote.range.create();
    return range && {
        sc: range.sc,
        so: range.so,
        ec: range.ec,
        eo: range.eo,
    };
};
/**
 *
 * @param {Node} startNode 
 * @param {Number} startOffset
 * @param {Node} endNode
 * @param {Number} endOffset
*/
Wysiwyg.setRange = function (startNode, startOffset, endNode, endOffset) {
    $(startNode).focus();
    if (endNode) {
        $.summernote.range.create(startNode, startOffset, endNode, endOffset).normalize().select();
    } else {
        $.summernote.range.create(startNode, startOffset).normalize().select();
    }
    // trigger for Unbreakable
    $(startNode.tagName ? startNode : startNode.parentNode).trigger('wysiwyg.range');
};
/**
 *
 * @param {Node} node - dom node
 * @param {Object} [options]
 * @param {boolean} options.begin move the range to the beginning of the first node.
 * @param {boolean} options.end move the range to the end of the last node.
*/
Wysiwyg.setRangeFromNode = function (node, options) {
    var last = node;
    while (last.lastChild) { last = last.lastChild; }
    var first = node;
    while (first.firstChild) { first = first.firstChild; }

    if (options && options.begin && !options.end) {
        Wysiwyg.setRange(first, 0);
    } else if (options && !options.begin && options.end) {
        Wysiwyg.setRange(last, last.textContent.length);
    } else {
        Wysiwyg.setRange(first, 0, last, last.textContent.length);
    }
};

//--------------------------------------------------------------------------
// jQuery extensions
//--------------------------------------------------------------------------

$.extend($.expr[':'], {
    o_editable: function (node, i, m) {
        while (node) {
            if (node.className && _.isString(node.className)) {
                if (node.className.indexOf('o_not_editable') !== -1 || (node.attributes.contenteditable && node.attributes.contenteditable.value !== 'true')) {
                    return false;
                }
                if (node.className.indexOf('o_editable') !== -1 || (node.attributes.contenteditable && node.attributes.contenteditable.value === 'true')) {
                    return true;
                }
            }
            node = node.parentNode;
        }
        return false;
    },
});

return Wysiwyg;
});
