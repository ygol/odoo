odoo.define('web_editor.wysiwyg.snippets', function (require) {
'use strict';

var Wysiwyg = require('web_editor.wysiwyg');
var snippetsEditor = require('web_editor.snippet.editor');

Wysiwyg.include({
    events: _.extend({}, Wysiwyg.prototype.events, {
        'content_changed .o_editable': '_onChange',
    }),
    custom_events: _.extend({}, Wysiwyg.prototype.custom_events, {
        request_history_undo_record: '_onHistoryUndoRecordRequest',
    }),

    selectorEditableArea: '.note-editable',

    init: function (parent, options) {
        this._super.apply(this, arguments);

        options = _.clone(this.options);
        if (!options.snippets) {
            return;
        }
        if (options.snippets === true) {
            options.snippets = 'web_editor.snippets';
        }
        options.isUnbreakableNode = this.isUnbreakableNode.bind(this);
        options.isEditableNode = this.isEditableNode.bind(this);
        this.snippets = new snippetsEditor.Class(this, options);
    },
    /*
     * Preload snippets.
     *
     * @override
     **/
    willStart: function () {
        if (this.snippets) {
            this.snippets.loadSnippets(); // don't use the deferred
        }
        return this._super();
    },
    /**
     * add options (snippets) to load snippet building block
     * snippets can by url begin with '/' or an view xml_id
     *
     * @override
     * @params {string} [options.snippets]
     */
    start: function () {
        var self = this;
        this._super();
        if (!this.snippets) {
            return;
        }
        this.snippets.setSelectorEditableArea(this.$el, this.selectorEditableArea);
        this.snippets.insertBefore(this.$el).then(function () {
            self.$el.before(self.snippets.$el);
            setTimeout(function () { // add a set timeout for the transition
                self.snippets.$el.addClass('o_loaded');
                self.$el.addClass('o_snippets_loaded');
                self.trigger_up('snippets_loaded', self.snippets.$el);
            });
        });
        var $editable = $(this._summernote.layoutInfo.editable);
        $editable.on('scroll.wysiwyg', _.debounce(function () {
            self.snippets.updateCurrentSnippetEditorOverlay();
        }, 1));
    },
    /*
     * @override
     **/
    destroy: function () {
        if (this._summernote) {
            var $editable = $(this._summernote.layoutInfo.editable);
            $editable.off('scroll.wysiwyg');
        }
        this._super();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /*
     * @override
     */
    isUnbreakableNode: function (node) {
        if (!this.snippets) {
            return this._super(node);
        }
        return this._super(node) || node.tagName === 'DIV' || snippetsEditor.globalSelector.is($(node));
    },
    /*
     * @override
     */
    isEditableNode: function (node) {
        if (!this.snippets) {
            return this._super(node);
        }
        return this._super(node) &&
            (node.tagName !== 'DIV' || _.find(node.childNodes, function (node) {
                if (node.tagName === 'DIV' || node.tagName === 'TABLE') {
                    return false;
                }
                if (node.tagName) {
                    return true;
                }
                return node.textContent.match(/\S|\u00A0/);
            }));
    },
    /*
     * @override
     */
    save: function () {
        if (!this.snippets) {
            return this._super();
        }
        if (!this.isDirty()) {
            return $.when();
        }
        var defs = [];
        this.trigger_up('ready_to_save', {defs: defs});
        return $.when.apply($, defs)
            .then(this.snippets.cleanForSave.bind(this.snippets))
            .then(this._super.bind(this));
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    _onChange: function () {
        if (this.snippets) {
            this.snippets.updateCurrentSnippetEditorOverlay();
        }
        this._super.apply(this, arguments);
    },
    /**
     * Called when an element askes to record an history undo -> records it.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onHistoryUndoRecordRequest: function (ev) {
        this.addHistoryStep();
        this._onChange();
    },
});

//--------------------------------------------------------------------------
// jQuery extensions
//--------------------------------------------------------------------------

$.fn.extend({
    focusIn: function () {
        if (this.length) {
            Wysiwyg.setRangeFromNode(this[0], {begin: true});
            $(this).trigger('mouseup');
        }
        return this;
    },
    focusInEnd: function () {
        if (this.length) {
            Wysiwyg.setRangeFromNode(this[0], {end: true});
            $(this).trigger('mouseup');
        }
        return this;
    },
    selectContent: function () {
        if (this.length) {
            Wysiwyg.setRangeFromNode(this[0]);
            var range = $.summernote.range.create();
            if (!range.sc.tagName && range.so === 0 && range.sc.textContent[range.so] === '\u200B') {
                range.so += 1;
            }
            if (!range.ec.tagName && range.eo === range.ec.textContent.length && range.ec.textContent[range.eo - 1] === '\u200B') {
                range.eo -= 1;
            }
            range.normalize().select();
            $(this).trigger('mouseup');
        }
        return this;
    },
});

});
