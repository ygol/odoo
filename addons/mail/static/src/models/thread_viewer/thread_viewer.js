odoo.define('mail/static/src/models/thread_viewer/thread_viewer.js', function (require) {
'use strict';

const { registerNewModel } = require('mail/static/src/model/model_core.js');
const { RecordDeletedError } = require('mail/static/src/model/model_errors.js');
const { attr, many2many, many2one, one2one } = require('mail/static/src/model/model_field.js');

function factory(dependencies) {

    class ThreadViewer extends dependencies['mail.model'] {

        /**
         * @override
         */
        _willDelete() {
            clearTimeout(this._loaderTimeout);
            return super._willDelete(...arguments);
        }

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        /**
         * This function register a hint for the component related to this
         * record. Hints are information on changes around this viewer that
         * make require adjustment on the component. For instance, if this
         * thread viewer initiated a thread cache load and it now has become
         * loaded, then it may need to auto-scroll to last message.
         *
         * @param {string} hintType name of the hint. Used to determine what's
         *   the broad type of adjustement the component has to do.
         * @param {any} [hintData] data of the hint. Used to fine-tune
         *   adjustments on the component.
         */
        addComponentHint(hintType, hintData) {
            const hint = { data: hintData, type: hintType };
            this.update({
                componentHintList: this.componentHintList.concat([hint]),
            });
        }

        /**
         * @param {Object} hint
         */
        markComponentHintProcessed(hint) {
            let filterFun;
            switch (hint.type) {
                case 'current-partner-just-posted-message':
                    filterFun = h => h.type !== hint.type && h.messageId !== hint.data.messageId;
                    break;
                default:
                    filterFun = h => h.type !== hint.type;
                    break;
            }
            this.update({
                componentHintList: this.componentHintList.filter(filterFun),
            });
        }

        /**
         * @param {mail.message} message
         */
        handleVisibleMessage(message) {
            if (!this.lastVisibleMessage || this.lastVisibleMessage.id < message.id) {
                this.update({ lastVisibleMessage: [['link', message]] });
            }
        }

        /**
         * @param {string} scrollTop
         */
        saveThreadCacheScrollPositionsAsInitial(scrollTop) {
            if (!this.threadCache) {
                return;
            }
            this.update({
                threadCacheInitialScrollPositions: Object.assign({}, this.threadCacheInitialScrollPositions, {
                    [this.threadCache.localId]: scrollTop,
                }),
            });
        }

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * @private
         * @returns {string}
         */
        _computeStringifiedDomain() {
            if (this.discuss) {
                return this.discuss.stringifiedDomain;
            }
            return '[]';
        }

        /**
         * @private
         * @returns {mail.thread|undefined}
         */
         _computeThread() {
            if (this.chatter) {
                return [['link', this.chatter.thread]];
            }
            if (this.chatWindow) {
                return [['link', this.chatWindow.thread]];
            }
            if (this.discuss) {
                return [['link', this.discuss.thread]];
            }
            return [['unlink']];
        }

        /**
         * @private
         * @returns {mail.thread_cache}
         */
        _computeThreadCache() {
            this.addComponentHint('change-of-thread-cache');
            return [['link', this.thread.cache(this.stringifiedDomain)]];
        }

        /**
         * Not a real field, used to trigger `thread.markAsSeen` when one of
         * the dependencies changes.
         *
         * @private
         * @returns {boolean}
         */
        _computeThreadShouldBeSetAsSeen() {
            // FIXME condition should not be on "composer is focused" but "thread viewer is active"
            // See task-2277543
            const lastMessageIsVisible = this.lastVisibleMessage &&
                this.lastVisibleMessage === this.lastMessage;
            if (lastMessageIsVisible && this.hasComposerFocus && this.thread) {
                this.thread.markAsSeen().catch(e => {
                    // prevent crash when executing compute during destroy
                    if (!(e instanceof RecordDeletedError)) {
                        throw e;
                    }
                });
            }
            return true;
        }

        /**
         * @private
         * @returns {integer|undefined}
         */
        _computeThreadCacheInitialScrollPosition() {
            if (!this.threadCache) {
                return undefined;
            }
            return this.threadCacheInitialScrollPositions[this.threadCache.localId];
        }

        /**
         * @private
         */
        _onThreadCacheIsLoadingChanged() {
            if (this.threadCache && this.threadCache.isLoading) {
                if (!this.isLoading && !this.isPreparingLoading) {
                    this.update({ isPreparingLoading: true });
                    this.async(() =>
                        new Promise(resolve => {
                            this._loaderTimeout = setTimeout(resolve, 400);
                        }
                    )).then(() => {
                        const isLoading = this.threadCache
                            ? this.threadCache.isLoading
                            : false;
                        this.update({ isLoading, isPreparingLoading: false });
                    });
                }
                return;
            }
            clearTimeout(this._loaderTimeout);
            this.update({ isLoading: false, isPreparingLoading: false });
        }
    }

    ThreadViewer.fields = {
        chatter: one2one('mail.chatter', {
            inverse: 'threadViewer',
        }),
        chatterThread: many2one('mail.thread', {
            related: 'chatter.thread',
        }),
        chatWindow: one2one('mail.chat_window', {
            inverse: 'threadViewer',
        }),
        chatWindowThread: many2one('mail.thread', {
            related: 'chatWindow.thread',
        }),
        checkedMessages: many2many('mail.message', {
            related: 'threadCache.checkedMessages',
        }),
        /**
         * List of component hints. Hints contain information that help
         * components make UI/UX decisions based on their UI state.
         * For instance, on receiving new messages and the last message
         * is visible, it should auto-scroll to this new last message.
         *
         * Format of a component hint:
         *
         *   {
         *       type: {string} the name of the component hint. Useful
         *                      for components to dispatch behaviour
         *                      based on its type.
         *       data: {Object} data related to the component hint.
         *                      For instance, if hint suggests to scroll
         *                      to a certain message, data may contain
         *                      message id.
         *   }
         */
        componentHintList: attr({
            default: [],
        }),
        composer: many2one('mail.composer', {
            related: 'thread.composer',
        }),
        discuss: one2one('mail.discuss', {
            inverse: 'threadViewer',
        }),
        discussThread: many2one('mail.thread', {
            related: 'discuss.thread',
        }),
        discussStringifiedDomain: attr({
            related: 'discuss.stringifiedDomain',
        }),
        hasComposerFocus: attr({
            related: 'composer.hasFocus',
        }),
        /**
         * States whether the thread cache displayed by this thread viewer is
         * currently loading messages.
         *
         * This field is related to `threadCache.isLoading` but with a delay on
         * its update to avoid flickering on the UI.
         *
         * It is computed through `_onThreadCacheIsLoadingChanged` and it should
         * otherwise be considered read-only.
         */
        isLoading: attr({
            default: false,
        }),
        /**
         * States whether this thread viewer is aware of its thread cache
         * currently loading messages, but this thread viewer is not yet ready
         * to reflect this state on the UI.
         *
         * It is computed through `_onThreadCacheIsLoadingChanged` and it should
         * otherwise be considered read-only.
         *
         * @see `isLoading` field
         */
        isPreparingLoading: attr({
            default: false,
        }),
        lastMessage: many2one('mail.message', {
            related: 'thread.lastMessage',
        }),
        /**
         * Most recent message in the current thread viewer that has been shown
         * to the current partner.
         */
        lastVisibleMessage: many2one('mail.message'),
        messages: many2many('mail.message', {
            related: 'threadCache.messages',
        }),
        /**
         * @see `isLoading` field
         */
        onThreadCacheIsLoadingChanged: attr({
            compute: '_onThreadCacheIsLoadingChanged',
            dependencies: [
                'threadCache',
                'threadCacheIsLoading',
            ],
        }),
        /**
         * Domain to apply when fetching messages for the current thread.
         */
        stringifiedDomain: attr({
            compute: '_computeStringifiedDomain',
            dependencies: [
                'discussStringifiedDomain',
            ],
        }),
        /**
         * Thread currently displayed by this thread viewer.
         */
        thread: many2one('mail.thread', {
            compute: '_computeThread',
            dependencies: [
                'chatterThread',
                'chatWindowThread',
                'discussThread',
            ],
            inverse: 'viewers',
        }),
        /**
         * Thread cache currently displayed by this thread viewer.
         */
        threadCache: many2one('mail.thread_cache', {
            compute: '_computeThreadCache',
            dependencies: [
                'stringifiedDomain',
                'thread',
            ],
            inverse: 'threadViewers',
        }),
        threadCacheInitialScrollPosition: attr({
            compute: '_computeThreadCacheInitialScrollPosition',
            dependencies: [
                'threadCache',
                'threadCacheInitialScrollPositions',
            ],
        }),
        /**
         * Whether the current thread cache is loading.
         */
        threadCacheIsLoading: attr({
            related: 'threadCache.isLoading',
        }),
        /**
         * List of saved initial scroll positions of thread caches.
         * Useful to restore scroll position on changing back to this
         * thread cache. Note that this is only applied when opening
         * the thread cache, because scroll position may change fast so
         * save is already throttled
         */
        threadCacheInitialScrollPositions: attr({
            default: {},
        }),
        /**
         * Not a real field, used to trigger `thread.markAsSeen` when one of
         * the dependencies changes.
         */
        threadShouldBeSetAsSeen: attr({
            compute: '_computeThreadShouldBeSetAsSeen',
            dependencies: [
                'hasComposerFocus',
                'lastMessage',
                'lastVisibleMessage',
                'threadCache',
            ],
        }),
        uncheckedMessages: many2many('mail.message', {
            related: 'threadCache.uncheckedMessages',
        }),
    };

    ThreadViewer.modelName = 'mail.thread_viewer';

    return ThreadViewer;
}

registerNewModel('mail.thread_viewer', factory);

});
