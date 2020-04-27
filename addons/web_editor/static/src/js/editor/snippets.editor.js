odoo.define('web_editor.snippet.editor', function (require) {
'use strict';

var concurrency = require('web.concurrency');
var core = require('web.core');
var Dialog = require('web.Dialog');
var dom = require('web.dom');
var Widget = require('web.Widget');
var snippetOptions = require('web_editor.snippets.options');
var JWEditorLib = require('web_editor.jabberwock');

var _t = core._t;

/**
 * Management of the overlay and option list for a snippet.
 *
 * A snippet editor is atually the block that is associate to one child
 * of the snippet.
 *
 * What this class do?
 *
 * - toggel overlay
 * - initialize options
 *
 * | -- to be adapted in jabberwock --|
 *
 * - remove element related to the "snippetEditor".
 */
var SnippetEditor = Widget.extend({
    template: 'web_editor.snippet_overlay',
    xmlDependencies: ['/web_editor/static/src/xml/snippets.xml'],
    custom_events: {
        'option_update': '_onOptionUpdate',
        'user_value_widget_request': '_onUserValueWidgetRequest',
        'snippet_option_update': '_onSnippetOptionUpdate',
        'snippet_option_visibility_update': '_onSnippetOptionVisibilityUpdate',
    },

    /**
     * @constructor
     * @param {Widget} parent
     * @param {Element} target
     * @param {Object} templateOptions
     * @param {jQuery} $editable
     * @param {Object} options
     */
    init: function (parent, snippetElement, templateOptions, $editable, vNode, options) {
        this._super.apply(this, arguments);
        this.options = options;
        this.$editable = $editable;
        this.$snippetBlock = $(snippetElement);
        this.$snippetBlock.data('snippet-editor', this);
        this.$body = $(document.body);
        this.templateOptions = templateOptions;
        this.isTargetParentEditable = false;
        this.isTargetMovable = false;
        this.vNode = vNode;
        this.editorCommands = options.wysiwyg.editorCommands;

        this.__isStarted = new Promise(resolve => {
            this.__isStartedResolveFunc = resolve;
        });
    },
    /**
     * @override
     */
    start: function () {
        var defs = [this._super.apply(this, arguments)];

        // Initialize the associated options (see snippets.options.js)
        defs.push(this._initializeOptions());
        var $customize = this._customize$Elements[this._customize$Elements.length - 1];

        // todo: bettech check if the targetParent is editable
        this.isTargetParentEditable = true;
        // this.isTargetParentEditable = this.$snippetBlock.parent().is(':o_editable');
        this.isTargetMovable = this.isTargetParentEditable && this.isTargetMovable;

        // Initialize move/clone/remove buttons
        if (this.isTargetMovable) {
            this.dropped = false;
            this.$el.draggable({
                greedy: true,
                appendTo: document.body,
                cursor: 'move',
                handle: '.o_move_handle',
                cursorAt: {
                    left: 18,
                    top: 14
                },
                helper: () => {
                    var $clone = this.$el.clone().css({width: '24px', height: '24px', border: 0});
                    $clone.appendTo(this.$body).removeClass('d-none');
                    return $clone;
                },
                start: this._onDragAndDropStart.bind(this),
                stop: (...args) => {
                    // Delay our stop handler so that some summernote handlers
                    // which occur on mouseup (and are themself delayed) are
                    // executed first (this prevents the library to crash
                    // because our stop handler may change the DOM).
                    setTimeout(() => {
                        this._onDragAndDropStop(...args);
                    }, 0);
                },
            });
        } else {
            this.$('.o_overlay_move_options').addClass('d-none');
            $customize.find('.oe_snippet_clone').addClass('d-none');
        }

        if (!this.isTargetParentEditable) {
            $customize.find('.oe_snippet_remove').addClass('d-none');
        }

        var _animationsCount = 0;
        var postAnimationCover = _.throttle(() => this.cover(), 100);
        this.$snippetBlock.on('transitionstart.snippet_editor, animationstart.snippet_editor', () => {
            // We cannot rely on the fact each transition/animation start will
            // trigger a transition/animation end as the element may be removed
            // from the DOM before or it could simply be an infinite animation.
            //
            // By simplicity, for each start, we add a delayed operation that
            // will decrease the animation counter after a fixed duration and
            // do the post animation cover if none is registered anymore.
            _animationsCount++;
            setTimeout(() => {
                if (!--_animationsCount) {
                    postAnimationCover();
                }
            }, 500); // This delay have to be huge enough to take care of long
                     // animations which will not trigger an animation end event
                     // but if it is too small for some, this is the job of the
                     // animation creator to manually ask for a re-cover
        });
        // On top of what is explained above, do the post animation cover for
        // each detected transition/animation end so that the user does not see
        // a flickering when not needed.
        this.$snippetBlock.on('transitionend.snippet_editor, animationend.snippet_editor', postAnimationCover);

        return Promise.all(defs).then(() => {
            this.__isStartedResolveFunc(this);
        });
    },
    /**
     * @override
     */
    destroy: function () {
        this._super(...arguments);
        this.$snippetBlock.removeData('snippet-editor');
        this.$snippetBlock.off('.snippet_editor');
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Checks whether the snippet options are shown or not.
     *
     * @returns {boolean}
     */
    areOptionsShown: function () {
        const lastIndex = this._customize$Elements.length - 1;
        return !!this._customize$Elements[lastIndex].parent().length;
    },
    /**
     * Notifies all the associated snippet options that the snippet has just
     * been dropped in the page.
     */
    buildSnippet: async function () {
        for (var i in this.snippetOptionInstances) {
            this.snippetOptionInstances[i].onBuilt();
        }
        await this.toggleTargetVisibility(true);
    },
    /**
     * Notifies all the associated snippet options that the template which
     * contains the snippet is about to be saved.
     */
    cleanForSave: async function () {
        if (this.isDestroyed()) {
            return;
        }
        await this.toggleTargetVisibility(!this.$snippetBlock.hasClass('o_snippet_invisible'));
        const proms = _.map(this.snippetOptionInstances, option => {
            return option.cleanForSave();
        });
        await Promise.all(proms);
    },
    /**
     * Closes all widgets of all options.
     */
    closeWidgets: function () {
        if (!this.snippetOptionInstances || !this.areOptionsShown()) {
            return;
        }
        Object.keys(this.snippetOptionInstances).forEach(key => {
            this.snippetOptionInstances[key].closeWidgets();
        });
    },
    /**
     * Makes the editor overlay cover the associated snippet.
     */
    cover: function () {
        if (!this.isShown() || !this.$snippetBlock.length || !this.$snippetBlock.is(':visible')) {
            return;
        }
        var offset = this.$snippetBlock.offset();
        var manipulatorOffset = this.$el.parent().offset();
        offset.top -= manipulatorOffset.top;
        offset.left -= manipulatorOffset.left;
        this.$el.css({
            width: this.$snippetBlock.outerWidth(),
            left: offset.left,
            top: offset.top,
        });
        this.$('.o_handles').css('height', this.$snippetBlock.outerHeight());
        this.$el.toggleClass('o_top_cover', offset.top < this.$editable.offset().top);
    },
    /**
     * DOMElements have a default name which appears in the overlay when they
     * are being edited. This method retrieves this name; it can be defined
     * directly in the DOM thanks to the `data-name` attribute.
     */
    getName: function () {
        if (this.$snippetBlock.data('name') !== undefined) {
            return this.$snippetBlock.data('name');
        }
        if (this.$snippetBlock.parent('.row').length) {
            return _t("Column");
        }
        return _t("Block");
    },
    /**
     * @return {boolean}
     */
    isShown: function () {
        return this.$el && this.$el.parent().length && this.$el.hasClass('oe_active');
    },
    /**
     * @returns {boolean}
     */
    isTargetVisible: function () {
        return (this.$snippetBlock[0].dataset.invisible !== '1');
    },
    /**
     * Removes the associated snippet from the DOM and destroys the associated
     * editor (itself).
     *
     * @returns {Promise}
     */
    removeSnippet: async function () {
        this.toggleOverlay(false);
        this.toggleOptions(false);

        await new Promise(resolve => {
            this.trigger_up('call_for_each_child_snippet', {
                $snippet: this.$snippetBlock,
                callback: function (editor, $snippet) {
                    for (var i in editor.snippetOptionInstances) {
                        editor.snippetOptionInstances[i].onRemove();
                    }
                    resolve();
                },
            });
        });

        this.trigger_up('go_to_parent', {$snippet: this.$snippetBlock});
        var $parent = this.$snippetBlock.parent();
        this.$snippetBlock.find('*').addBack().tooltip('dispose');
        this.$snippetBlock.remove();
        this.$el.remove();

        var node = $parent[0];
        if (node && node.firstChild) {
            if (!node.firstChild.tagName && node.firstChild.textContent === ' ') {
                node.removeChild(node.firstChild);
            }
        }

        if ($parent.closest(':data("snippet-editor")').length) {
            var editor = $parent.data('snippet-editor');
            while (!editor) {
                var $nextParent = $parent.parent();
                if (isEmptyAndRemovable($parent)) {
                    $parent.remove();
                }
                $parent = $nextParent;
                editor = $parent.data('snippet-editor');
            }
            if (isEmptyAndRemovable($parent, editor)) {
                // TODO maybe this should be part of the actual Promise being
                // returned by the function ?
                setTimeout(() => editor.removeSnippet());
            }
        }

        // clean editor if they are image or table in deleted content
        this.$body.find('.note-control-selection').hide();
        this.$body.find('.o_table_handler').remove();

        this.trigger_up('snippet_removed');
        this.destroy();
        $parent.trigger('content_changed');

        function isEmptyAndRemovable($el, editor) {
            editor = editor || $el.data('snippet-editor');
            return $el.children().length === 0 && $el.text().trim() === ''
                && !$el.hasClass('oe_structure') && (!editor || editor.isTargetParentEditable);
        }
    },
    /**
     * Displays/Hides the editor overlay.
     *
     * @param {boolean} show
     * @param {boolean} [previewMode=false]
     */
    toggleOverlay: function (show, previewMode) {
        console.log('toggleOverlay', show, previewMode)
        console.log('this.$el', this.$el)
        if (!this.$el) {
            return;
        }

        if (previewMode) {
            // In preview mode, the sticky classes are left untouched, we only
            // add/remove the preview class when toggling/untoggling
            this.$el.toggleClass('o_we_overlay_preview', show);
        } else {
            // In non preview mode, the preview class is always removed, and the
            // sticky class is added/removed when toggling/untoggling
            this.$el.removeClass('o_we_overlay_preview');
            this.$el.toggleClass('o_we_overlay_sticky', show);
        }

        show = this.$el.hasClass('o_we_overlay_sticky') ? true : show;

        // Show/hide overlay in preview mode or not
        this.$el.toggleClass('oe_active', show);
        this.cover();
    },
    /**
     * Displays/Hides the editor (+ parent) options and call onFocus/onBlur if
     * necessary.
     *
     * @param {boolean} show
     */
    toggleOptions: function (show) {
        if (!this.$el) {
            return;
        }

        if (this.areOptionsShown() === show) {
            return;
        }
        this.trigger_up('update_customize_elements', {
            customize$Elements: show ? this._customize$Elements : [],
        });
        this._customize$Elements.forEach(($el, i) => {
            const editor = $el.data('editor');
            const options = _.chain(editor.snippetOptionInstances).values().sortBy('__order')
                            .value();
            // TODO ideally: should account the async parts of updateUI and
            // allow async parts in onFocus/onBlur.
            if (show) {
                // All onFocus before all updateUI as the onFocus of an option
                // might affect another option (like updating the $target)
                options.forEach(option => option.onFocus());
                options.forEach(option => option.updateUI());
            } else {
                options.forEach(option => option.onBlur());
            }
        });
    },
    /**
     * @param {boolean} [show]
     * @returns {Promise<boolean>}
     */
    toggleTargetVisibility: async function (show) {
        show = this._toggleVisibilityStatus(show);
        var options = _.values(this.snippetOptionInstances);
        const proms = _.sortBy(options, '__order').map(option => {
            return show ? option.onTargetShow() : option.onTargetHide();
        });
        await Promise.all(proms);
        return show;
    },
    /**
     * @param {boolean} [isTextEdition=false]
     */
    toggleTextEdition: function (isTextEdition) {
        if (this.$el) {
            this.$el.toggleClass('o_keypress', !!isTextEdition && this.isShown());
        }
    },
    /**
     * Clones the current snippet.
     *
     * @private
     * @param {boolean} recordUndo
     */
    clone: async function (recordUndo) {
        this.trigger_up('snippet_will_be_cloned', {$target: this.$snippetBlock});

        const $clonedContent = this.$snippetBlock.clone(false);

        const vNode = await this.editorCommands.insertHtml(
            [this.$snippetBlock[0], 'AFTER'],
            $clonedContent[0].outerHTML
        );
        const jwEditor = this.options.wysiwyg.editor;
        const dom = jwEditor.plugins.get(JWEditorLib.Dom);
        const $clone = $(dom.domMap.toDom(vNode)[0][0]);

        // todo: handle history undo in jabberwock

        await new Promise(resolve => {
            this.trigger_up('call_for_each_child_snippet', {
                $snippet: $clone,
                callback: function (editor, $snippet) {
                    for (const i in editor.snippetOptionInstances) {
                        editor.snippetOptionInstances[i].onClone({
                            isCurrent: ($snippet.is($clone)),
                        });
                    }
                    resolve();
                },
            });
        });
        this.trigger_up('snippet_cloned', {$target: $clone, $origin: this.$snippetBlock});

        $clone.trigger('content_changed');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Instantiates the snippet's options.
     *
     * @private
     */
    _initializeOptions: function () {
        this._customize$Elements = [];
        this.snippetOptionInstances = {};
        this.selectorSiblings = [];
        this.selectorChildren = [];

        var $element = this.$snippetBlock.parent();
        while ($element.length) {
            var parentEditor = $element.data('snippet-editor');
            if (parentEditor) {
                this._customize$Elements = this._customize$Elements
                    .concat(parentEditor._customize$Elements);
                break;
            }
            $element = $element.parent();
        }

        var $optionsSection = $(core.qweb.render('web_editor.customize_block_options_section', {
            name: this.getName(),
        })).data('editor', this);
        const $optionsSectionBtnGroup = $optionsSection.find('we-button-group');
        $optionsSectionBtnGroup.contents().each((i, node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                node.parentNode.removeChild(node);
            }
        });
        $optionsSection.on('mouseenter', this._onOptionsSectionMouseEnter.bind(this));
        $optionsSection.on('mouseleave', this._onOptionsSectionMouseLeave.bind(this));
        $optionsSection.on('click', 'we-title > span', this._onOptionsSectionClick.bind(this));
        $optionsSection.on('click', '.oe_snippet_clone', this._onCloneClick.bind(this));
        $optionsSection.on('click', '.oe_snippet_remove', this._onRemoveClick.bind(this));
        this._customize$Elements.push($optionsSection);

        // TODO get rid of this when possible (made as a fix to support old
        // theme options)
        this.$el.data('$optionsSection', $optionsSection);

        var orderIndex = 0;
        var defs = _.map(this.templateOptions, option => {
            if (!option.selector.is(this.$snippetBlock)) {
                return;
            }
            if (option['drop-near']) {
                this.selectorSiblings.push(option['drop-near']);
            }
            if (option['drop-in']) {
                this.selectorChildren.push(option['drop-in']);
            }

            var optionName = option.option;
            const optionInstance = new (snippetOptions.registry[optionName] || snippetOptions.SnippetOptionWidget)(
                this,
                option.$el.children(),
                this.$snippetBlock,
                option.base_target,
                this.$el,
                _.extend({
                    optionName: optionName,
                    snippetName: this.getName(),
                }, option.data),
                this.options
            );
            var optionId = optionName || _.uniqueId('option');
            if (this.snippetOptionInstances[optionId]) {
                // If two snippet options use the same option name (and so use
                // the same JS option), store the subsequent ones with a unique
                // ID (TODO improve)
                optionId = _.uniqueId(optionId);
            }
            this.snippetOptionInstances[optionId] = optionInstance;
            optionInstance.__order = orderIndex++;
            return optionInstance.appendTo(document.createDocumentFragment());
        });

        this.isTargetMovable = (this.selectorSiblings.length > 0 || this.selectorChildren.length > 0);

        this.$el.find('[data-toggle="dropdown"]').dropdown();

        return Promise.all(defs).then(() => {
            const options = _.sortBy(this.snippetOptionInstances, '__order');
            options.forEach(option => {
                if (option.isTopOption) {
                    $optionsSectionBtnGroup.prepend(option.$el);
                } else {
                    $optionsSection.append(option.$el);
                }
            });
            $optionsSection.toggleClass('d-none', options.length === 0);
        });
    },
    /**
     * @private
     * @param {boolean} [show]
     */
    _toggleVisibilityStatus: function (show) {
        if (show === undefined) {
            show = !this.isTargetVisible();
        }
        if (show) {
            delete this.$snippetBlock[0].dataset.invisible;
        } else {
            this.$snippetBlock[0].dataset.invisible = '1';
        }
        return show;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when the 'clone' button is clicked.
     *
     * @private
     * @param {Event} ev
     */
    _onCloneClick: function (ev) {
        ev.preventDefault();
        this.clone(true);
    },
    /**
     * Called when the snippet is starting to be dragged thanks to the 'move'
     * button.
     *
     * @private
     */
    _onDragAndDropStart: function () {
        var self = this;
        this.dropped = false;
        self.size = {
            width: self.$snippetBlock.width(),
            height: self.$snippetBlock.height()
        };
        self.$snippetBlock.after('<div class="oe_drop_clone" style="display: none;"/>');
        self.$snippetBlock.detach();
        self.$el.addClass('d-none');

        var $selectorSiblings;
        for (var i = 0; i < self.selectorSiblings.length; i++) {
            if (!$selectorSiblings) {
                $selectorSiblings = self.selectorSiblings[i].all();
            } else {
                $selectorSiblings = $selectorSiblings.add(self.selectorSiblings[i].all());
            }
        }
        var $selectorChildren;
        for (i = 0; i < self.selectorChildren.length; i++) {
            if (!$selectorChildren) {
                $selectorChildren = self.selectorChildren[i].all();
            } else {
                $selectorChildren = $selectorChildren.add(self.selectorChildren[i].all());
            }
        }

        this.trigger_up('go_to_parent', {$snippet: this.$snippetBlock});
        this.trigger_up('activate_insertion_zones', {
            $selectorSiblings: $selectorSiblings,
            $selectorChildren: $selectorChildren,
        });

        this.$body.addClass('move-important');

        this.$editable.find('.oe_drop_zone').droppable({
            over: function () {
                self.$editable.find('.oe_drop_zone.hide').removeClass('hide');
                $(this).addClass('hide').first().after(self.$snippetBlock);
                self.dropped = true;
            },
            out: function () {
                $(this).removeClass('hide');
                self.$snippetBlock.detach();
                self.dropped = false;
            },
        });
    },
    /**
     * Called when the snippet is dropped after being dragged thanks to the
     * 'move' button.
     *
     * @private
     * @param {Event} ev
     * @param {Object} ui
     */
    _onDragAndDropStop: function (ev, ui) {
        // TODO lot of this is duplicated code of the d&d feature of snippets
        if (!this.dropped) {
            var $el = $.nearest({x: ui.position.left, y: ui.position.top}, '.oe_drop_zone', {container: document.body}).first();
            if ($el.length) {
                $el.after(this.$snippetBlock);
                this.dropped = true;
            }
        }

        this.$editable.find('.oe_drop_zone').droppable('destroy').remove();

        var prev = this.$snippetBlock.first()[0].previousSibling;
        var next = this.$snippetBlock.last()[0].nextSibling;
        var $parent = this.$snippetBlock.parent();

        var $clone = this.$editable.find('.oe_drop_clone');
        if (prev === $clone[0]) {
            prev = $clone[0].previousSibling;
        } else if (next === $clone[0]) {
            next = $clone[0].nextSibling;
        }
        $clone.after(this.$snippetBlock);
        var $from = $clone.parent();

        this.$el.removeClass('d-none');
        this.$body.removeClass('move-important');
        $clone.remove();

        if (this.dropped) {
            this.trigger_up('request_history_undo_record', {$target: this.$snippetBlock});

            if (prev) {
                this.$snippetBlock.insertAfter(prev);
            } else if (next) {
                this.$snippetBlock.insertBefore(next);
            } else {
                $parent.prepend(this.$snippetBlock);
            }

            for (var i in this.snippetOptionInstances) {
                this.snippetOptionInstances[i].onMove();
            }

            this.$snippetBlock.trigger('content_changed');
            $from.trigger('content_changed');
        }

        this.trigger_up('drag_and_drop_stop', {
            $snippet: this.$snippetBlock,
        });
    },
    /**
     * @private
     */
    _onOptionsSectionMouseEnter: function (ev) {
        if (!this.$snippetBlock.is(':visible')) {
            return;
        }
        this.trigger_up('activate_snippet', {
            $element: this.$snippetBlock,
            previewMode: true,
        });
    },
    /**
     * @private
     */
    _onOptionsSectionMouseLeave: function (ev) {
        // this.trigger_up('deactivate_snippet');
    },
    /**
     * @private
     */
    _onOptionsSectionClick: function (ev) {
        this.trigger_up('activate_snippet', {
            $element: this.$snippetBlock,
            previewMode: false,
        });
    },
    /**
     * Called when a child editor/option asks for another option to perform a
     * specific action/react to a specific event.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onOptionUpdate: function (ev) {
        var self = this;

        // If multiple option names are given, we suppose it should not be
        // propagated to parent editor
        if (ev.data.optionNames) {
            ev.stopPropagation();
            _.each(ev.data.optionNames, function (name) {
                notifyForEachMatchedOption(name);
            });
        }
        // If one option name is given, we suppose it should be handle by the
        // first parent editor which can do it
        if (ev.data.optionName) {
            if (notifyForEachMatchedOption(ev.data.optionName)) {
                ev.stopPropagation();
            }
        }

        function notifyForEachMatchedOption(name) {
            var regex = new RegExp('^' + name + '\\d+$');
            var hasOption = false;
            for (var key in self.snippetOptionInstances) {
                if (key === name || regex.test(key)) {
                    self.snippetOptionInstances[key].notify(ev.data.name, ev.data.data);
                    hasOption = true;
                }
            }
            return hasOption;
        }
    },
    /**
     * Called when the 'remove' button is clicked.
     *
     * @private
     * @param {Event} ev
     */
    _onRemoveClick: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.trigger_up('request_history_undo_record', {$target: this.$snippetBlock});
        this.removeSnippet();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onSnippetOptionUpdate: async function (ev) {
        if (ev.data.previewMode) {
            ev.data.onSuccess();
            return;
        }

        const proms1 = Object.keys(this.snippetOptionInstances).map(key => {
            return this.snippetOptionInstances[key].updateUI({
                forced: ev.data.widget,
                noVisibility: true,
            });
        });
        await Promise.all(proms1);

        const proms2 = Object.keys(this.snippetOptionInstances).map(key => {
            return this.snippetOptionInstances[key].updateUIVisibility();
        });
        await Promise.all(proms2);

        ev.data.onSuccess();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onSnippetOptionVisibilityUpdate: function (ev) {
        ev.data.show = this._toggleVisibilityStatus(ev.data.show);
    },
    /**
     * @private
     * @param {Event} ev
     */
    _onUserValueWidgetRequest: function (ev) {
        ev.stopPropagation();
        for (const key of Object.keys(this.snippetOptionInstances)) {
            const widget = this.snippetOptionInstances[key].findWidget(ev.data.name);
            if (widget) {
                ev.data.onSuccess(widget);
                return;
            }
        }
    },
});

return SnippetEditor;
});
