odoo.define('wysiwyg.widgets.MediaDialog', function (require) {
'use strict';

var core = require('web.core');
var MediaModules = require('wysiwyg.widgets.media');
var Dialog = require('wysiwyg.widgets.Dialog');

var _t = core._t;

/**
 * MediaDialog widget. Lets users change a media, including uploading a
 * new image, font awsome or video and can change a media into an other
 * media.
 */
var MediaDialog = Dialog.extend({
    template: 'wysiwyg.widgets.media',
    xmlDependencies: Dialog.prototype.xmlDependencies.concat(
        ['/web_editor/static/src/xml/editor.xml']
    ),
    events : _.extend({}, Dialog.prototype.events, {
        'input input#icon-search': '_onSearchInput',
        'click a[data-toggle="tab"]': '_onTabChange',
        'shown.bs.tab a[data-toggle="tab"]': '_updateControlPanel',
        'click .previous:not(.disabled), .next:not(.disabled)': '_onPagerClick',
    }),
    custom_events: _.extend({}, Dialog.prototype.custom_events || {}, {
        save_request: '_onSaveRequest',
        update_control_panel: '_updateControlPanel',
    }),

    /**
     * @constructor
     */
    init: function (parent, options, media) {
        var self = this;
        options = options || {};

        this._super(parent, _.extend({}, {
            title: _t("Select a Media"),
        }, options));

        this.trigger_up('getRecordInfo', {recordInfo: options});

        this.media = media;
        this.$media = $(media);

        this.multiImages = options.multiImages;
        var onlyImages = options.onlyImages || this.multiImages || (this.media && (this.$media.parent().data('oeField') === 'image' || this.$media.parent().data('oeType') === 'image'));
        this.noImages = options.noImages;
        this.noDocuments = onlyImages || options.noDocuments;
        this.noIcons = onlyImages || options.noIcons;
        this.noVideos = onlyImages || options.noVideos;

        if (!this.noDocuments) {
            this.documentDialog = new MediaModules.ImageWidget(this, this.media, _.extend({}, options, {document: true}));
        }
        if (!this.noIcons) {
            this.iconDialog = new MediaModules.IconWidget(this, this.media, options);
        }
        if (!this.noVideos) {
            this.videoDialog = new MediaModules.VideoWidget(this, this.media, options);
        }
        if (!this.noImages) {
            this.imageDialog = new MediaModules.ImageWidget(this, this.media, options);
        }

        var tabToShow = 'icon';
        this.active = this.iconDialog;
        if (!this.media || this.$media.is('img')) {
            tabToShow = 'image';
            this.active = this.imageDialog;
        } else if (this.$media.is('a.o_image')) {
            tabToShow = 'document';
            this.active = this.documentDialog;
        } else if (this.$media.hasClass('media_iframe_video')) {
            tabToShow = 'video';
            this.active = this.videoDialog;
        } else if (this.$media.parent().hasClass('media_iframe_video')) {
            this.$media = this.$media.parent();
            this.media = this.$media[0];
            tabToShow = 'video';
            this.active = this.videoDialog;
        }

        this.opened(function () {
            self.$('[href="#editor-media-' + tabToShow + '"]').tab('show');
        });

        this._onSearchInput = _.debounce(this._onSearchInput, 250);
    },
    /**
     * @override
     */
    start: function () {
        var self = this;
        var defs = [this._super.apply(this, arguments)];
        this.$modal.addClass('note-image-dialog');
        this.$modal.find('.modal-dialog').addClass('o_select_media_dialog');

        if (this.imageDialog) {
            this.imageDialog.clear();
        }
        if (this.documentDialog) {
            this.documentDialog.clear();
        }
        if (this.iconDialog) {
            this.iconDialog.clear();
        }
        if (this.videoDialog) {
            this.videoDialog.clear();
        }

        if (this.imageDialog) {
            defs.push(this.imageDialog.appendTo(this.$("#editor-media-image")));
        }
        if (this.documentDialog) {
            defs.push(this.documentDialog.appendTo(this.$("#editor-media-document")));
        }
        if (this.iconDialog) {
            defs.push(this.iconDialog.appendTo(this.$("#editor-media-icon")));
        }
        if (this.videoDialog) {
            defs.push(this.videoDialog.appendTo(this.$("#editor-media-video")));
        }

        return $.when.apply($, defs).then(function () {
            self._setActive(self.active);
            self._updateControlPanel();
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    save: function () {
        var self = this;
        var args = arguments;
        var _super = this._super;
        if (this.multiImages) {
            // In the case of multi images selection we suppose this was not to
            // replace an old media, so we only retrieve the images and save.
            return $.when(this.active.save()).then(function (data) {
                self.final_data = data;
                return _super.apply(self, args);
            });
        }

        return $.when(this.active.save()).then(function (media) {
            self.trigger('saved', {
                attachments: self.active.images,
                media: media,
            });
            return _super.apply(self, args);
        });
    },

    //--------------------------------------------------------------------------
    //
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _setActive: function (widget) {
        this.active = widget;
        this.active.goToPage(0);
    },
    /**
     * @private
     */
    _updateControlPanel: function () {
        var cpConfig = this.active.getControlPanelConfig();
        this.$('li.search').toggleClass('d-none', !cpConfig.searchEnabled);
        this.$('.previous, .next').toggleClass('d-none', !cpConfig.pagerEnabled);
        this.$('.previous').toggleClass("disabled", !cpConfig.pagerLeftEnabled);
        this.$('.next').toggleClass("disabled", !cpConfig.pagerRightEnabled);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onPagerClick: function (ev) {
        this.active.goToPage(this.active.page + ($(ev.currentTarget).hasClass('previous') ? -1 : 1));
        this._updateControlPanel();
    },
    /**
     * @private
     */
    _onSaveRequest: function (ev) {
        ev.stopPropagation();
        this.save();
    },
    /**
     * @private
     */
    _onSearchInput: function (ev) {
        var self = this;
        this.active.goToPage(0);
        this.active.search($(ev.currentTarget).val() || '').then(function () {
            self._updateControlPanel();
        });
    },
    /**
     * @private
     */
    _onTabChange: function (ev) {
        var $target = $(ev.target);
        if ($target.is('[href="#editor-media-image"]')) {
            this._setActive(this.imageDialog);
        } else if ($target.is('[href="#editor-media-document"]')) {
            this._setActive(this.documentDialog);
        } else if ($target.is('[href="#editor-media-icon"]')) {
            this._setActive(this.active = this.iconDialog);
        } else if ($target.is('[href="#editor-media-video"]')) {
            this._setActive(this.active = this.videoDialog);
        }
    },
});

return MediaDialog;
});
