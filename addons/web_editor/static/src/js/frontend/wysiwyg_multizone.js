odoo.define('web_editor.wysiwyg.multizone', function (require) {
'use strict';
var concurrency = require('web.concurrency');
var config = require('web.config');
var core = require('web.core');
var mixins = require('web.mixins');
var ServicesMixin = require('web.ServicesMixin');
var Wysiwyg = require('web_editor.wysiwyg');

var QWeb = core.qweb;
var _t = core._t;


/**
 * HtmlEditor
 * Intended to edit HTML content. This widget uses the Wysiwyg editor
 * improved by odoo.
 *
 * class editable: o_editable
 * class non editable: o_not_editable
 *
 */
var WysiwygMultizone = Wysiwyg.extend({
    events: {
        'keyup *': function (ev) {
            if ((ev.keyCode === 8 || ev.keyCode === 46)) {
                var $target = $(ev.target).closest('.o_editable');
                if (!$target.is(':has(*:not(p):not(br))') && !$target.text().match(/\S/)) {
                    $target.empty();
                }
            }
            if (ev.key.length === 1) {
                this._onChange();
            }
        },
        'click .note-editable': function (ev) {
            ev.preventDefault();
        },
        'submit .note-editable form .btn': function (ev) {
            ev.preventDefault(); // Disable form submition in editable mode
        },
        'hide.bs.dropdown .dropdown': function (ev) {
            // Prevent dropdown closing when a contenteditable children is focused
            if (ev.originalEvent
                    && $(ev.target).has(ev.originalEvent.target).length
                    && $(ev.originalEvent.target).is('[contenteditable]')) {
                ev.preventDefault();
            }
        },
    },
    custom_events: _.extend({}, Wysiwyg.prototype.custom_events, {
        activate_snippet:  '_onActivateSnippet',
    }),
    /**
     * Use 'attachTo'
     *
     * @override
     *
     * @param {Object} options.context - the context to use for the saving rpc
     * @param {boolean} [options.withLang=false]
     *        false if the lang must be omitted in the context (saving "master"
     *        page element)
     */
    init: function (parent, options) {
        options = options || {};
        options.addDropSelector = ':o_editable';
        this.savingMutex = new concurrency.Mutex();
        this._super(parent, options);
    },
    /**
     * Prevent some default features for the editable area.
     *
     * @private
     */
    start: function () {
        var self = this;
        this._super();
        // Unload preserve
        var flag = false;
        window.onbeforeunload = function (event) {
            if (self.isDirty() && !flag) {
                flag = true;
                _.defer(function () { flag=false; });
                return _t('This document is not saved!');
            }
        };
        // firefox & IE fix
        try {
            document.execCommand('enableObjectResizing', false, false);
            document.execCommand('enableInlineTableEditing', false, false);
            document.execCommand('2D-position', false, false);
        } catch (e) { /* */ }
        document.body.addEventListener('resizestart', function (evt) {evt.preventDefault(); return false;});
        document.body.addEventListener('movestart', function (evt) {evt.preventDefault(); return false;});
        document.body.addEventListener('dragstart', function (evt) {evt.preventDefault(); return false;});
        // BOOTSTRAP preserve
        this.init_bootstrap_carousel = $.fn.carousel;
        $.fn.carousel = function () {
            var res = self.init_bootstrap_carousel.apply(this, arguments);
            // off bootstrap keydown event to remove event.preventDefault()
            // and allow to change cursor position
            $(this).off('keydown.bs.carousel');
            return res;
        };
        this.$('.dropdown-toggle').dropdown();
        this.$el
            .tooltip({
                selector: '[data-oe-readonly]',
                container: 'body',
                trigger: 'hover',
                delay: { 'show': 1000, 'hide': 100 },
                placement: 'bottom',
                title: _t("Readonly field")
            })
            .on('click', function () {
                $(this).tooltip('hide');
            });
        $('body').addClass('editor_enable');
        $('.note-editor, .note-popover').filter('[data-wysiwyg-id="' + this.id + '"]').addClass('wysiwyg_multizone');
        $('.note-editable .note-editor, .note-editable .note-editable').attr('contenteditable', false);
    },
    /**
     * @override
     */
    destroy: function () {
        this._super();
        this.$target.css('display', '');
        this.$target.find('[data-old-id]').add(this.$target).each(function () {
            var $node = $(this);
            $node.attr('id', $node.attr('data-old-id')).removeAttr('data-old-id');
        });
        $('body').removeClass('editor_enable');
        window.onbeforeunload = null;
        $.fn.carousel = this.init_bootstrap_carousel;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /*
     *
     * @override
     * @returns {$.Promise} resolve with true if the content was dirty
     */
    save: function () {
        return this._super().then(function (isDirty, html) {
            this._summernote.layoutInfo.editable.html(html);

            var $editable = this._getEditableArea();
            var $areaDirty = $editable.filter('.o_dirty');
            if (!$areaDirty.length) {
                return false;
            }
            this.savingMutex.exec(this._saveCroppedImages.bind(this));
            $areaDirty.each(function (index, editable) {
                this.savingMutex.exec(this._saveEditable.bind(this, editable));
            }.bind(this));
            return this.savingMutex.def
                .then(this._super.bind(this))
                .then(function () {return true;});
        }.bind(this));
    },
    isDirty: function () {
        return this._getEditableArea().filter('.o_dirty').length;
    },
    /*
     * @override
     */
    isEditableNode: function (node) {
        return this._super(node) && $(node).is(':o_editable');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _editorOptions: function () {
        var self = this;
        var options = this._super();
        options.toolbar[8] = ['view', ['help']];
        options.popover.image[4] = ['editImage', ['cropImage', 'transform']];
        return _.extend(options, {
            styleWithSpan: false,
            followingToolbar: false,
        });
    },
    /**
     * @private
     */
    _saveEditable: function (editable) {
        var self = this;
        var recordInfo = this._getRecordInfo({target: editable});
        var outerHTML = this._getCleanedHtml(editable).prop('outerHTML');
        var def = this._saveElement(outerHTML, recordInfo, editable);
        def.done(function () {
            self.trigger_up('saved', recordInfo);
        }).fail(function () {
            self.trigger_up('canceled', recordInfo);
        });
        return def;
    },
    /**
     * @private
     * @returns {Promise}
     */
    _saveCroppedImages: function () {
        var self = this;
        var $area = $(this.selectorEditableArea, this.$target);
        var defs = $area.find('.o_cropped_img_to_save').map(function (croppedImg) {
            var $croppedImg = $(croppedImg);
            $croppedImg.removeClass('o_cropped_img_to_save');
            var resModel = $croppedImg.data('crop:resModel');
            var resID = $croppedImg.data('crop:resID');
            var cropID = $croppedImg.data('crop:id');
            var mimetype = $croppedImg.data('crop:mimetype');
            var originalSrc = $croppedImg.data('crop:originalSrc');
            var datas = $croppedImg.attr('src').split(',')[1];
            if (!cropID) {
                var name = originalSrc + '.crop';
                return self._rpc({
                    model: 'ir.attachment',
                    method: 'create',
                    args: [{
                        res_model: resModel,
                        res_id: resID,
                        name: name,
                        datas_fname: name,
                        datas: datas,
                        mimetype: mimetype,
                        url: originalSrc, // To save the original image that was cropped
                    }],
                }).then(function (attachmentID) {
                    return self._rpc({
                        model: 'ir.attachment',
                        method: 'generate_access_token',
                        args: [[attachmentID]],
                    }).then(function (access_token) {
                        $croppedImg.attr('src', '/web/image/' + attachmentID + '?access_token=' + access_token[0]);
                    });
                });
            } else {
                return self._rpc({
                    model: 'ir.attachment',
                    method: 'write',
                    args: [[cropID], {datas: datas}],
                });
            }
        }).get();
        return $.when.apply($, defs);
    },
    /**
     * Saves one (dirty) element of the page.
     *
     * @private
     * @param {string} outerHTML
     * @param {Object} recordInfo
     * @param {DOM} editable
     * @returns {Promise}
     */
    _saveElement: function (outerHTML, recordInfo, editable) {
        return this._rpc({
            model: 'ir.ui.view',
            method: 'save',
            args: [
                recordInfo.res_id,
                outerHTML,
                recordInfo.xpath,
                recordInfo.context,
            ],
        });
    },
    /**
     * Internal text nodes escaped for XML storage.
     *
     * @private
     * @param {jQuery} $el
     */
    _escapedElements: function ($el) {
        var toEscape = $el.find('*').addBack();
        toEscape = toEscape.not(toEscape.filter('object,iframe,script,style,[data-oe-model][data-oe-model!="ir.ui.view"]').find('*').addBack());
        toEscape.contents().each(function () {
            if (this.nodeType === 3) {
                this.nodeValue = $('<div />').text(this.nodeValue).html();
            }
        });
    },
    /**
     * Gets jQuery cloned element with clean for XML storage
     *
     * @private
     * @param {jQuery} $el
     * @return {jQuery}
     */
    _getCleanedHtml: function (editable) {
        var $el = $(editable).clone().removeClass('o_editable o_dirty');
        this._escapedElements($el);
        return $el;
    },
    /**
     * @override
     */
    _getRecordInfo: function (options) {
        options = options || {};
        var $editable = $(options.target).closest(this._getEditableArea());
        if (!$editable.length) {
            $editable = $(this._getFocusedEditable());
        }
        var data = this._super();
        var res_id = $editable.data('oe-id');
        var res_model = $editable.data('oe-model');
        if (!$editable.data('oe-model')) {
            var object = $('html').data('main-object');
            res_model = object.split('(')[0];
            res_id = +object.split('(')[1].split(',')[0];
        }
        return _.extend(data, {
            res_id: res_id,
            res_model: res_model,
            xpath: $editable.data('oe-xpath'),
        });
    },
    /**
     * @private
     */
    _getFocusedEditable: function () {
        return $(this._focusedNode).closest(this._getEditableArea())[0];
    },
    /**
     * @private
     */
    _getEditableArea: function () {
        if (!this._summernote) {
            return $();
        }
        return $(this.selectorEditableArea, this._summernote.layoutInfo.editable);
    },
    /**
     * @override
     */
    _loadInstance: function () {
        return this._super().then(function () {
            var $target = this.$target;
            var id = $target.attr('id');
            var className = $target.attr('class');
            $target.off('.WysiwygFrontend');
            this.$target.find('[id]').add(this.$target).each(function () {
                var $node = $(this);
                $node.attr('data-old-id', $node.attr('id')).removeAttr('id');
            });
            this.$('.note-editable:first').attr('id', id).addClass(className);
            this.selectorEditableArea = '.o_editable';
        }.bind(this));
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _onActivateSnippet: function (ev) {
        if (!$.contains(ev.data[0], this._focusedNode)) {
            this._focusedNode = ev.data[0];
        }
    },
    /**
     * @override
     */
    _onChange: function () {
        var editable = this._getFocusedEditable();
        $(editable).addClass('o_dirty');
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    _onFocusnode: function (node) {
        this._focusedNode = node;
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    _onHistoryUndoRecordRequest: function (ev) {
        if (!$.contains(ev.data.$target[0], this._focusedNode)) {
            this._focusedNode = ev.data.$target[0];
        }
        this._super.apply(this, arguments);
    },
});

return WysiwygMultizone;
});