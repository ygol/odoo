odoo.define('website.s_countdown_options', function (require) {
'use strict';

const core = require('web.core');
const snippetOptions = require('web_editor.snippets.options');

const qweb = core.qweb;

snippetOptions.registry.countdown = snippetOptions.SnippetOptionWidget.extend({
    events: _.extend({}, snippetOptions.SnippetOptionWidget.prototype.events || {}, {
        'click .toggle-edit-message': '_onToggleEndMessageClick',
    }),

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Changes the countdown action at zero.
     *
     * @see this.selectClass for parameters
     */
    endAction: async function (previewMode, widgetValue, params) {
        await this.wysiwyg.editor.execCommand(async (context) => {
            await this.editorHelpers.setAttribute(context, this.$target[0], `data-end-action`, widgetValue);
            if (widgetValue === 'message') {
                if (!this.$target.find('.s_countdown_end_message').length) {
                    const message = this.endMessage || qweb.render('website.s_countdown.end_message');
                    await this.editorHelpers.insertHtml(context, message, this.$target.find('.container')[0], 'INSIDE');
                }
            } else {
                const $message = this.$target.find('.s_countdown_end_message');
                if ($message.length) {
                    this.endMessage = $message[0].outerHTML;
                }
                await this.editorHelpers.remove(context, $message[0]);
            }
        });
    },
    /**
    * Changes the countdown style.
    *
    * @see this.selectClass for parameters
    */
    layout: async function (previewMode, widgetValue, params) {
            switch (widgetValue) {
                case 'circle':
                    if (!previewMode) {
                        await this.editor.execCommand(async (context) => {
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-progress-bar-style', 'disappear');
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-progress-bar-weight', 'thin');
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-layout-background', 'none');
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-layout', widgetValue);
                        });
                    } else {
                        this.$target[0].dataset.progressBarStyle = 'disappear';
                        this.$target[0].dataset.progressBarWeight = 'thin';
                        this.$target[0].dataset.layoutBackground = 'none';
                    }
                    break;
                case 'boxes':
                    if (!previewMode) {
                        await this.editor.execCommand(async (context) => {
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-progress-bar-style', 'none');
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-layout-background', 'plain');
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-layout', widgetValue);
                        });
                    } else {
                        this.$target[0].dataset.progressBarStyle = 'none';
                        this.$target[0].dataset.layoutBackground = 'plain';
                    }
                    break;
                case 'clean':
                    if (!previewMode) {
                        await this.editor.execCommand(async (context) => {
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-progress-bar-style', 'none');
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-layout-background', 'none');
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-layout', widgetValue);
                        });
                    } else {
                        this.$target[0].dataset.progressBarStyle = 'none';
                        this.$target[0].dataset.layoutBackground = 'none';
                    }
                    break;
                case 'text':
                    if (!previewMode) {
                        await this.editor.execCommand(async (context) => {
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-progress-bar-style', 'none');
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-layout-background', 'none');
                            await this.editorHelpers.setAttribute(context, this.$target[0], 'data-layout', widgetValue);
                        });
                    } else {
                        this.$target[0].dataset.progressBarStyle = 'none';
                        this.$target[0].dataset.layoutBackground = 'none';
                    }
                    break;
            }
            this.$target[0].dataset.layout = widgetValue;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    updateUIVisibility: async function () {
        await this._super(...arguments);
        const dataset = this.$target[0].dataset;

        // End Action UI
        this.$el.find('.toggle-edit-message')
            .toggleClass('d-none', dataset.endAction !== 'message');

        // End Message UI
        this.updateUIEndMessage();
    },
    /**
     * @see this.updateUI
     */
    updateUIEndMessage: function () {
        this.$target.find('.s_countdown_canvas_wrapper')
            .toggleClass("d-none", this.showEndMessage === true && this.$target.hasClass("hide-countdown"));
        this.$target.find('.s_countdown_end_message')
            .toggleClass("d-none", !this.showEndMessage);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        switch (methodName) {
            case 'endAction':
            case 'layout':
                return this.$target[0].dataset[methodName];
        }
        return this._super(...arguments);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onToggleEndMessageClick: function () {
        this.showEndMessage = !this.showEndMessage;
        this.$el.find(".toggle-edit-message")
            .toggleClass('text-primary', this.showEndMessage);
        this.updateUIEndMessage();
        this.trigger_up('cover_update');
    },
});
});
