odoo.define('website_blog.new_blog_post', function (require) {
'use strict';

var core = require('web.core');
var wUtils = require('website.utils');
var WebsiteNewMenu = require('website.newMenu');

var _t = core._t;

WebsiteNewMenu.include({
    actions: _.extend({}, WebsiteNewMenu.prototype.actions || {}, {
        new_blog_post: '_createNewBlogPost',
    }),

    //--------------------------------------------------------------------------
    // Actions
    //--------------------------------------------------------------------------

    /**
     * Asks the user information about a new blog post to create, then creates
     * it and redirects the user to this new post.
     *
     * @private
     * @returns {Promise} Unresolved if there is a redirection
     */
    _createNewBlogPost: function () {
        return this._rpc({
            model: 'blog.blog',
            method: 'search_read',
            args: [wUtils.websiteDomain(this), ['name']],
        }).then(function (blogs) {
            if (blogs.length === 1) {
                document.location = '/blog/' + blogs[0]['id'] + '/post/new';
                return new Promise(function () {});
            } else if (blogs.length > 1) {
                return wUtils.prompt({
                    id: 'editor_new_blog',
                    window_title: _t("New Blog Post"),
                    select: _t("Select Blog"),
                    init: function (field) {
                        return _.map(blogs, function (blog) {
                            return [blog['id'], blog['name']];
                        });
                    },
                }).then(function (result) {
                    var blog_id = result.val;
                    if (!blog_id) {
                        return;
                    }
                    document.location = '/blog/' + blog_id + '/post/new';
                    return new Promise(function () {});
                });
            }
        });
    },
});
});

//==============================================================================

odoo.define('website_blog.editor', function (require) {
'use strict';

require('web.dom_ready');
const {qweb, _t} = require('web.core');
const {ComponentWrapper, WidgetAdapterMixin} = require('web.OwlCompatibility');
const options = require('web_editor.snippets.options');
const UserValue = require('website.component.UserValue');
var WysiwygMultizone = require('web_editor.wysiwyg.multizone');

if (!$('.website_blog').length) {
    return Promise.reject("DOM doesn't contain '.website_blog'");
}

const NEW_TAG_PREFIX = 'new-blog-tag-';

WysiwygMultizone.include({
    custom_events: Object.assign({}, WysiwygMultizone.prototype.custom_events, {
        'set_blog_post_updated_tags': '_onSetBlogPostUpdatedTags',
    }),

    /**
     * @override
     */
    init() {
        this._super(...arguments);
        this.blogTagsPerBlogPost = {};
    },
    /**
     * @override
     */
    async start() {
        await this._super(...arguments);
        $('.js_tweet, .js_comment').off('mouseup').trigger('mousedown');
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async save() {
        const ret = await this._super(...arguments);
        await this._saveBlogTags(); // Note: important to be called after save otherwise cleanForSave is not called before
        return ret;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Saves the blog tags in the database.
     *
     * @private
     */
    async _saveBlogTags() {
        for (const [key, tags] of Object.entries(this.blogTagsPerBlogPost)) {
            const proms = tags.filter(tag => typeof tag.id === 'string').map(tag => {
                return this._rpc({
                    model: 'blog.tag',
                    method: 'create',
                    args: [{
                        'name': tag.name,
                    }],
                });
            });
            const createdIDs = await Promise.all(proms);

            await this._rpc({
                model: 'blog.post',
                method: 'write',
                args: [parseInt(key), {
                    'tag_ids': [[6, 0, tags.filter(tag => typeof tag.id === 'number').map(tag => tag.id).concat(createdIDs)]],
                }],
            });
        }
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onSetBlogPostUpdatedTags: function (ev) {
        this.blogTagsPerBlogPost[ev.data.blogPostID] = ev.data.tags;
    },
});

options.registry.many2one.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _selectRecord: function ($opt) {
        var self = this;
        this._super.apply(this, arguments);
        if (this.$target.data('oe-field') === 'author_id') {
            var $nodes = $('[data-oe-model="blog.post"][data-oe-id="'+this.$target.data('oe-id')+'"][data-oe-field="author_avatar"]');
            $nodes.each(function () {
                var $img = $(this).find('img');
                var css = window.getComputedStyle($img[0]);
                $img.css({ width: css.width, height: css.height });
                $img.attr('src', '/web/image/res.partner/'+self.ID+'/image_1024');
            });
            setTimeout(function () { $nodes.removeClass('o_dirty'); },0);
        }
    }
});

options.registry.CoverProperties.include({
    /**
     * @override
     */
    updateUI: async function () {
        await this._super(...arguments);
        var isRegularCover = this.$target.is('.o_wblog_post_page_cover_regular');
        var $coverFull = this.$el.find('[data-select-class*="o_full_screen_height"]');
        var $coverMid = this.$el.find('[data-select-class*="o_half_screen_height"]');
        var $coverAuto = this.$el.find('[data-select-class*="cover_auto"]');
        this._coverFullOriginalLabel = this._coverFullOriginalLabel || $coverFull.text();
        this._coverMidOriginalLabel = this._coverMidOriginalLabel || $coverMid.text();
        this._coverAutoOriginalLabel = this._coverAutoOriginalLabel || $coverAuto.text();
        $coverFull.children('div').text(isRegularCover ? _t("Large") : this._coverFullOriginalLabel);
        $coverMid.children('div').text(isRegularCover ? _t("Medium") : this._coverMidOriginalLabel);
        $coverAuto.children('div').text(isRegularCover ? _t("Tiny") : this._coverAutoOriginalLabel);
    },
});

options.registry.BlogPostTagSelection = options.Class.extend(WidgetAdapterMixin, {
    custom_events: _.extend({}, options.Class.prototype.custom_events, {
        save_user_value: '_onSaveUserValue',
    }),

    /**
     * @override
     */
    async willStart() {
        const _super = this._super.bind(this);

        this.blogPostID = parseInt(this.$target[0].dataset.blogId);
        const tags = await this._rpc({
            model: 'blog.tag',
            method: 'search_read',
            args: [[], ['id', 'name', 'post_ids']],
        });
        this.allTagsByID = {};
        this.tagIDs = [];
        for (const tag of tags) {
            this.allTagsByID[tag.id] = tag;
            if (tag['post_ids'].includes(this.blogPostID)) {
                this.tagIDs.push(tag.id);
            }
        }

        return _super(...arguments);
    },
    /**
     * @override
     */
    async _renderCustomXML(uiFragment) {
        setTimeout(async () => {
            const selectedTags = [];
            const unselectedTags = [];
            for (const [key, tag] of Object.entries(this.allTagsByID)) {
                if (this.tagIDs.includes(parseInt(key))) {
                    selectedTags.push(tag.name);
                } else {
                    unselectedTags.push(tag.name);
                }
            }
            this._userValue = new ComponentWrapper(this, UserValue, {
                selectedRecords: selectedTags,
                unselectedRecords: unselectedTags,
                recordName: 'Tag',
                create: true,
            });
            await this._userValue.mount($('.o_wblog_tag_container').get(1));
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} ev
     * @param {Object} [ev.data]
     * @param {String[]} [ev.data.selectedRecords]
     * @param {String[]} [ev.data.newRecords]
     */
    _onSaveUserValue(ev) {
        for (tag of ev.data.newRecords) {
            const newTagID = _.uniqueId(NEW_TAG_PREFIX);
            this.allTagsByID[newTagID] = {
                'id': newTagID,
                'name': tag,
            };
        }
        const tags = Object.values(this.allTagsByID).filter(tag => ev.data.selectedRecords.includes(tag.name));
        this.trigger_up('set_blog_post_updated_tags', {
            blogPostID: this.blogPostID,
            tags,
        });
    }
});
});
