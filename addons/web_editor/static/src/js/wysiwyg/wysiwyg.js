odoo.define('web_editor.wysiwyg', function (require) {
'use strict';

var Widget = require('web.Widget');
var JWEditorLib = require('web_editor.jabberwock');
var SnippetsMenu = require('web_editor.snippet.editor').SnippetsMenu;


var Wysiwyg = Widget.extend({
    // todo: theses tree keys currently comes from previous editor.js
    xmlDependencies: ['/web_editor/static/src/xml/editor.xml'],
    events: {
        'click button[data-action=save]': '_onSaveClick',
        'click button[data-action=cancel]': '_onCancelClick',
    },
    custom_events: {
        request_editable: '_onRequestEditable',
        request_history_undo_record: '_onHistoryUndoRecordRequest',
        request_save: '_onSaveRequest',
    },



    /**
     * @options {Object} options
     * @options {Object} options.recordInfo
     * @options {Object} options.recordInfo.context
     * @options {String} [options.recordInfo.context]
     * @options {integer} [options.recordInfo.res_id]
     * @options {String} [options.recordInfo.data_res_model]
     * @options {integer} [options.recordInfo.data_res_id]
     *   @see _onGetRecordInfo
     *   @see _getAttachmentsDomain in /wysiwyg/widgets/media.js
     * @options {Object} options.attachments
     *   @see _onGetRecordInfo
     *   @see _getAttachmentsDomain in /wysiwyg/widgets/media.js (for attachmentIDs)
     * @options {function} options.generateOptions
     *   called with the summernote configuration object used before sending to summernote
     *   @see _editorOptions
     **/
    init: function (parent, options) {
        this._super.apply(this, arguments);
        this.value = options.value || '';
        this.options = options;
    },
    /**
     * Load assets and color picker template then call summernote API
     * and replace $el by the summernote editable node.
     *
     * @override
     **/
    willStart: async function () {
        // this._summernoteManager = new SummernoteManager(this);

        // this.jwEditor = new JWEditorLib.JWEditor();

        // const $element = $('<div>');
        // $element.html(this.value);
        // $element.html('foo');
        // this.jwEditor = new JWEditorLib.JWEditor($element[0]);

        // this.jwEditor.start();
        // const p = document.createElement('p');
        // p.innerHTML = "coucou";
        // // this.jwEditor.setValue(p)

        // this.$el.html(this.jwEditor.el);

        // console.log('this.$el:', this.$el)

        // let element = this.$el[0];
        // if (element.tagName === 'TEXTAREA') {

        // }

        // $('.homepage').show()
        // new SummernoteManager(this);
        // this.$target = this.$el;

        // if (!this.options.inIframe) {
        //     return this._super();
        // }

        // var defAsset;
        // if (this.options.iframeCssAssets) {
        //     defAsset = ajax.loadAsset(this.options.iframeCssAssets);
        // } else {
        //     defAsset = Promise.resolve({
        //         cssLibs: [],
        //         cssContents: []
        //     });
        // }

        // promiseWysiwyg = promiseWysiwyg || ajax.loadAsset('web_editor.wysiwyg_iframe_editor_assets');
        // this.defAsset = Promise.all([promiseWysiwyg, defAsset]);

        this.$target = this.$el;
        return this._super.bind(this);
        // return this.defAsset
        //     .then(this._loadIframe.bind(this))
        //     .then(this._super.bind(this));
    },
    /**
     *
     * @override
     */
    start: async function () {
        // this.$target.wrap('<odoo-wysiwyg-container>');
        // this.$el = this.$target.parent();
        // var options = this._editorOptions();
        // this.$target.summernote(options);
        // this.$editor = this.$('.note-editable:first');
        // this.$editor.data('wysiwyg', this);
        // this.$editor.data('oe-model', options.recordInfo.res_model);
        // this.$editor.data('oe-id', options.recordInfo.res_id);
        // $(document).on('mousedown', this._blur);
        // this._value = this.$target.html() || this.$target.val();

        // todo: change elementToParse to let the editor take any value
        const elementToParse = document.createElement('div');
        elementToParse.innerHTML = this.value;
        this.editor = new JWEditorLib.BasicEditor(elementToParse);
        // this.editor.load(JWEditorLib.DevTools);
        this.editor.configure(JWEditorLib.Dom, {
            autoFocus: true,
            target: elementToParse,
        });
        this.editor.start();
        this.$el.html(this.editor.el);
        this.$el.show();

        // handle megamenu

        if (this.options.snippets) {
            this.$webEditorToolbar = $('<div id="web_editor-toolbars">');

            var $toolbarHandler = $('#web_editor-top-edit');
            $toolbarHandler.append(this.$webEditorToolbar);

            // this.snippetsMenu = new SnippetsMenu(this, Object.assign({
            //     $el: $(this.editor.el),
            //     selectorEditableArea: '.o_editable',
            // }, this.options));
            // await this.snippetsMenu.insertAfter($toolbarHandler);
            // this.snippetsMenu.$snippetEditorArea.insertAfter(this.snippetsMenu.$el);

            // this.$editor = this.editor.rte.editable();
            // await this.editor.prependTo(this.$editor[0].ownerDocument.body);
            this.trigger_up('edit_mode');

            // todo: adapt all $el.trigger('content_changed') to not use the calling of the dom
            // this.$el.on('content_changed', function (e) {
            //     self.trigger_up('wysiwyg_change');
            // });
        } else {
            return this._super.apply(this, arguments);
        }
    },

    /**
     * @override
     */
    destroy: function () {
        // $(document).off('mousedown', this._blur);
        // if (this.$target && this.$target.is('textarea') && this.$target.next('.note-editor').length) {
        //     this.$target.summernote('destroy');
        // }
        this._super();
    },
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------
    /**
     * Return the editable area.
     *
     * @returns {jQuery}
     */
    getEditable: function () {
        return this.$editor;
    },
    /**
     * Return true if the content has changed.
     *
     * @returns {Boolean}
     */
    isDirty: function () {
        // todo: use jweditor memory to know if it's dirty.
        //       something like jweditor.getMemorySliceId() === currentMemorySliceId
        return true;
    },
    /**
     * Set the focus on the element.
     */
    focus: function () {
        // todo: handle tab that need to go to next field if the editor does not
        //       catch it.
        this.$el.find('[contenteditable="true"]').focus()
    },
    /**
     * Get the value of the editable element.
     *
     * @param {object} [options]
     * @param {jQueryElement} [options.$layout]
     * @returns {String}
     */
    getValue: function (options) {
        // var $editable = options && options.$layout || this.$editor.clone();
        // $editable.find('[contenteditable]').removeAttr('contenteditable');
        // $editable.find('[class=""]').removeAttr('class');
        // $editable.find('[style=""]').removeAttr('style');
        // $editable.find('[title=""]').removeAttr('title');
        // $editable.find('[alt=""]').removeAttr('alt');
        // $editable.find('[data-original-title=""]').removeAttr('data-original-title');
        // $editable.find('a.o_image, span.fa, i.fa').html('');
        // $editable.find('[aria-describedby]').removeAttr('aria-describedby').removeAttr('data-original-title');

        // todo: do a static editor.render('dom') tha provide the last value or
        //       hook the change of the renderer to cache the last rendered
        //       value.
        const editable = this.editor.el.querySelector('jw-editor > [contenteditable]')
        return editable.innerHTML;
    },
    /**
     * What happend when you add an image?
     * - It get's added in the backend directly from the modal through rpc.
     * - The image is inserted in the html with the url targeting the
     *   `ir.attachment`.
     *
     * What happend when you save a page on odoo?
     * - If it's an html_field, use the classic write. Nothing special.
     *   question: do we need to clean something here?
     *   question: does the rte was activated here: no
     * - In case of the mass_mailing, there is a hack to save two values.
     *  - One that represent the "original source" value
     *  - The other one that is used to send the mails with "inline css"
     *
     * - oherwise:
     *
     * - Prepare/pre-save/clean the document to only have valid values to save
     *   - pre-save: translation (overriden wysiwyg_multizone_translate.js)
     *   - pre-save,clean: call cleanForSave for:
     *     - snippetMenu.cleanForSave
     *     - snippetEditor.cleanForSave
     *     - snippetOption.cleanForSave (all of them)
     *
     *  wysiwy_multizone.js override rte defaut saving mechanism
     * - save: the zones
     * - save: the megamenu
     * - save: the cover properties
     * - save: newsletter_popup (overriden in website_mass_mailing.editor.js)
     *
     *
     * - Save all editables boxes. In case of a field html for the mass mailing,
     *   there is only one "box".
     *
     *   In case of the website, 3 different kind of boxes need to be
     *   considered. "oe_structure", "fields" and "newsletter_popup".
     *   - oe_structure: differents zone of the page target differents odoo
     *     views and need to be saved independently see method `editable
     *     on`"editor_menu.js"
     *   - field: When a field is changed it should be saved directly through
     *     rpc.
     *   - newsletter_popup: see website_mass_mailing.editor.js
     *      - We need to save the newsletter popups that were created in
     *        the page.
     *
     *   - as a first implementation strategy will it might be easier to render
     *     the "fields" and "oe_structure" directly in the document.
     *   - In the future, we could directly send the modifications of the zones
     *     that changed to the server in a json structure.
     * 
     * - the rte provide _saveElement
     * - the wysiwyg_multizone provide _saveElement
     * - the newsletter_popup override _saveElement
     * - the multizoneTranslate override _saveElement
     *
     * Save the content in the target
     * - in init option beforeSave
     * - receive editable jQuery DOM as attribute
     * - called after deactivate codeview if needed
     * @returns {Promise} - resolve with true if the content was dirty
     */
    save: function () {
        // debugger
        throw new Error("Should not call save anymore. Use `getValue` and `isDirty` instead.")
        return this.getValue().then((html)=>{
            if (this.$el.is('textarea')) {
                this.$el.val(html);
            } else {
                this.$el.html(html);
            }
            // todo: retrive isDirty from JWEditor
            return {isDirty: true, html: html};
        })
    },
    /**
     * Create/Update cropped attachments.
     *
     * @param {jQuery} $editable
     * @returns {Promise}
     */
    saveCroppedImages: function ($editable) {
        return this._summernoteManager.saveCroppedImages($editable);
    },
    /**
     * @param {String} value
     * @param {Object} options
     * @param {Boolean} [options.notifyChange]
     * @returns {String}
     */
    setValue: function (value, options) {
        console.log('setValue', value)
        throw new Error("Should not call setValue anymore. Use `getValue` and `isDirty` instead.")
        // const editable = this.editor.el.querySelector('.jw-editable')
        // editable.innerHTML = value;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    // todo: field html need that binding. Find a way to connect it.
    _todoBind: function() {
        // ?
        self.trigger_up('wysiwyg_change');
        // when uploading attachment
        self.trigger_up('wysiwyg_attachment', attachments);
        // ?
        self.trigger_up('wysiwyg_focus');
        // ?
        self.trigger_up('wysiwyg_blur');
    },

    // todo: handle when the server error (previously carlos_danger)
    saveToServer: async function () {
        const defs = [];
        const promises = [];
        // this trigger will be catched by the "navbar" (i.e. the manager of
        // widgets). It will trigger an action on all thoses widget called
        // "on_save" so that they can do something before the saving occurs.
        //
        // Theses evens (ready_to_save and on_save) could be called respectively
        // "before_wysiwig_save" and "before_navbar_wysiwyg_save".
        //
        // Currently, there is only "content.js" and "edit.js" that receive that
        // event.
        this.trigger_up('ready_to_save', {defs: defs});
        await Promise.all(defs);

        if (this.snippetsMenu) {
            promises.push(this.snippetsMenu.cleanForSave());
        }
        promises.push(this._saveAllViewsBlocks());
        promises.push(this._saveCoverPropertiesBlocks());
        promises.push(this._saveMegaMenuBlocks());
        promises.push(this._saveNewsletterBlocks());
        promises.push(this._saveTranslationBlocks());
        promises.push(this._saveCroppedImages());

        return Promise.all(promises);
    },

    _saveAllViewsBlocks: async function (views) {
        const promises = [];
        for (const view of views) {
            promises.push(this._rpc({
                model: 'ir.ui.view',
                method: 'save',
                args: [
                    // todo: find out what to set here.
                    view.somethingToFindOut,
                    outerHTML,
                    // todo: find out what to set here.
                    view.somethingToFindOut,
                ],
                context: recordInfo.context,
            }));
        }

        return Promise.all(promises);
    },
    _saveCoverPropertiesBlocks: async function (editable) {
        var el = editable.closest('.o_record_cover_container');
        if (!el) {
            return;
        }

        var resModel = el.dataset.resModel;
        var resID = parseInt(el.dataset.resId);
        if (!resModel || !resID) {
            throw new Error('There should be a model and id associated to the cover');
        }

        this.__savedCovers = this.__savedCovers || {};
        this.__savedCovers[resModel] = this.__savedCovers[resModel] || [];

        if (this.__savedCovers[resModel].includes(resID)) {
            return;
        }
        this.__savedCovers[resModel].push(resID);

        var cssBgImage = $(el.querySelector('.o_record_cover_image')).css('background-image');
        var coverProps = {
            'background-image': cssBgImage.replace(/"/g, '').replace(window.location.protocol + "//" + window.location.host, ''),
            'background_color_class': el.dataset.bgColorClass,
            'background_color_style': el.dataset.bgColorStyle,
            'opacity': el.dataset.filterValue,
            'resize_class': el.dataset.coverClass,
            'text_align_class': el.dataset.textAlignClass,
        };

        return this._rpc({
            model: resModel,
            method: 'write',
            args: [
                resID,
                {'cover_properties': JSON.stringify(coverProps)}
            ],
        });
    },
    _saveMegaMenuBlocks: async function(outerHTML, recordInfo, editable) {
        // Saving mega menu options
        if ($el.data('oe-field') === 'mega_menu_content') {
            // On top of saving the mega menu content like any other field
            // content, we must save the custom classes that were set on the
            // menu itself.
            // FIXME normally removing the 'show' class should not be necessary here
            // TODO check that editor classes are removed here as well
            var classes = _.without($el.attr('class').split(' '), 'dropdown-menu', 'o_mega_menu', 'show');
            promises.push(this._rpc({
                model: 'website.menu',
                method: 'write',
                args: [
                    [parseInt($el.data('oe-id'))],
                    {
                        'mega_menu_classes': classes.join(' '),
                    },
                ],
            }));
        }
    },
    _saveNewsletterBlocks: async function(outerHTML, recordInfo, editable) {
        var self = this;
        var defs = [this._super.apply(this, arguments)];
        var $popups = $(editable).find('.o_newsletter_popup');
        _.each($popups, function (popup) {
            var $popup = $(popup);
            var content = $popup.data('content');
            if (content) {
                defs.push(self._rpc({
                    route: '/website_mass_mailing/set_content',
                    params: {
                        'newsletter_id': parseInt($popup.attr('data-list-id')),
                        'content': content,
                    },
                }));
            }
        });
        return Promise.all(defs);
    },
    _saveTranslationBlocks: async function($el, context, withLang) {
        var self = this;
        if ($el.data('oe-translation-id')) {
            return this._rpc({
                model: 'ir.translation',
                method: 'save_html',
                args: [
                    [+$el.data('oe-translation-id')],
                    this._getEscapedElement($el).html()
                ],
                context: context,
            });
        }
    },
    _saveCroppedImages: function ($editable) {
        var defs = _.map($editable.find('.o_cropped_img_to_save'), async croppedImg => {
            var $croppedImg = $(croppedImg);
            $croppedImg.removeClass('o_cropped_img_to_save');
 
            var resModel = $croppedImg.data('crop:resModel');
            var resID = $croppedImg.data('crop:resID');
            var cropID = $croppedImg.data('crop:id');
            var mimetype = $croppedImg.data('crop:mimetype');
            var originalSrc = $croppedImg.data('crop:originalSrc');
 
            var datas = $croppedImg.attr('src').split(',')[1];
            let attachmentID = cropID;
            if (!cropID) {
                var name = originalSrc + '.crop';
                attachmentID = await this._rpc({
                    model: 'ir.attachment',
                    method: 'create',
                    args: [{
                        res_model: resModel,
                        res_id: resID,
                        name: name,
                        datas: datas,
                        mimetype: mimetype,
                        url: originalSrc, // To save the original image that was cropped
                    }],
                });
            } else {
                await this._rpc({
                    model: 'ir.attachment',
                    method: 'write',
                    args: [[cropID], {datas: datas}],
                });
            }
            const access_token = await this._rpc({
                model: 'ir.attachment',
                method: 'generate_access_token',
                args: [[attachmentID]],
            });
            $croppedImg.attr('src', '/web/image/' + attachmentID + '?access_token=' + access_token[0]);
        });
        return Promise.all(defs);
    },

    _onAltDialogDemand: function (data) {
        if (data.__alreadyDone) {
            return;
        }
        data.__alreadyDone = true;
        var altDialog = new weWidgets.AltDialog(this,
            data.options || {},
            data.media
        );
        if (data.onSave) {
            altDialog.on('save', this, data.onSave);
        }
        if (data.onCancel) {
            altDialog.on('cancel', this, data.onCancel);
        }
        altDialog.open();
    },
    _onCropImageDialogDemand: function (data) {
        if (data.__alreadyDone) {
            return;
        }
        data.__alreadyDone = true;
        var cropImageDialog = new weWidgets.CropImageDialog(this,
            _.extend({
                res_model: data.$editable.data('oe-model'),
                res_id: data.$editable.data('oe-id'),
            }, data.options || {}),
            data.media
        );
        if (data.onSave) {
            cropImageDialog.on('save', this, data.onSave);
        }
        if (data.onCancel) {
            cropImageDialog.on('cancel', this, data.onCancel);
        }
        cropImageDialog.open();
    },
    _onLinkDialogDemand: function (data) {
        if (data.__alreadyDone) {
            return;
        }
        data.__alreadyDone = true;
        var linkDialog = new weWidgets.LinkDialog(this,
            data.options || {},
            data.$editable,
            data.linkInfo
        );
        if (data.onSave) {
            linkDialog.on('save', this, data.onSave);
        }
        if (data.onCancel) {
            linkDialog.on('cancel', this, data.onCancel);
        }
        linkDialog.open();
    },
    _onMediaDialogDemand: function (data) {
        if (data.__alreadyDone) {
            return;
        }
        data.__alreadyDone = true;

        var mediaDialog = new weWidgets.MediaDialog(this,
            _.extend({
                res_model: data.$editable.data('oe-model'),
                res_id: data.$editable.data('oe-id'),
                domain: data.$editable.data('oe-media-domain'),
            }, data.options),
            data.media
        );
        if (data.onSave) {
            mediaDialog.on('save', this, data.onSave);
        }
        if (data.onCancel) {
            mediaDialog.on('cancel', this, data.onCancel);
        }
        mediaDialog.open();
    },
});

return Wysiwyg;
});
