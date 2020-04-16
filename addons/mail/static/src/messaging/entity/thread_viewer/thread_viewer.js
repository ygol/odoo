odoo.define('mail.messaging.entity.ThreadViewer', function (require) {
'use strict';

const {
    fields: {
        attr,
        many2many,
        many2one,
        one2one,
    },
    registerNewEntity,
} = require('mail.messaging.entity.core');

function ThreadViewerFactory({ Entity }) {

    class ThreadViewer extends Entity {

        /**
         * @override
         */
        delete() {
            this._stopLoading();
            super.delete();
        }

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        /**
         * This function register a hint for the component related to this
         * entity. Hints are information on changes around this viewer that
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
            const hint = this._makeComponentHint(hintType, hintData);
            this.update({
                componentHintList: this.componentHintList.concat([hint]),
            });
        }

        /**
         * @param {mail.messaging.entity.ThreadCache} threadCache
         */
        handleThreadCacheLoaded(threadCache) {
            if (threadCache !== this.threadCache) {
                return;
            }
            this._stopLoading();
        }

        /**
         * @param {Object} hint
         */
        markComponentHintProcessed(hint) {
            let filterFun;
            switch (hint.type) {
                case 'current-partner-just-posted-message':
                    filterFun = h => h.type !== hint.type && h.messageId !== hint.messageId;
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
         * @returns {mail.messaging.entity.ThreadCache|undefined}
         */
        _computeThreadCache() {
            if (!this.thread) {
                return [];
            }
            return [['replace', this.thread.cache(this.stringifiedDomain)]];
        }

        /**
         * @private
         * @returns {integer|undefined}
         */
        _computeThreadCacheInitialPosition() {
            if (!this.threadCache) {
                return undefined;
            }
            return this.threadCacheInitialScrollPositions[this.threadCache.localId];
        }

        /**
         * @private
         */
        _prepareLoading() {
            this._isPreparingLoading = true;
            this._loaderTimeout = setTimeout(() => {
                this.isShowingLoading = true;
                this._isPreparingLoading = false;
            }, 400);
        }

        /**
         * @private
         */
        _stopLoading() {
            clearTimeout(this._loaderTimeout);
            this._loaderTimeout = null;
            this.isShowingLoading = false;
            this._isPreparingLoading = false;
        }

        /**
         * @private
         * @param {string} hintType
         * @param {any} hintData
         * @returns {Object}
         */
        _makeComponentHint(hintType, hintData) {
            let hint;
            switch (hintType) {
                case 'change-of-thread-cache':
                    hint = { type: hintType };
                    break;
                case 'current-partner-just-posted-message':
                    hint = {
                        messageId: hintData,
                        type: hintType,
                    };
                    break;
                case 'more-messages-loaded':
                    hint = { type: hintType };
                    break;
                default:
                    throw new Error(`Undefined component hint "${hintType}" for ThreadViewer`);
            }
            return hint;
        }

        /**
         * @override
         */
        _updateAfter(previous) {
            if (this.thread && this.thread !== previous.thread) {
                this._stopLoading();
                if (!this.threadCache.isLoaded && !this.threadCache.isLoading) {
                    this.threadCache.loadMessages();
                }
            }
            if (this.threadCache !== previous.threadCache) {
                this._stopLoading();
                this.addComponentHint('change-of-thread-cache');
            }

            if (
                this.thread && this.threadCache.isLoading &&
                !this.isShowingLoading && !this._isPreparingLoading
            ) {
                this._prepareLoading();
            }
        }

        /**
         * @override
         */
        _updateBefore() {
            return {
                thread: this.thread,
                threadCache: this.threadCache,
            };
        }

    }

    ThreadViewer.entityName = 'ThreadViewer';

    ThreadViewer.fields = {
        chatWindow: one2one('ChatWindow', {
            inverse: 'threadViewer',
        }),
        checkedMessages: many2many('Message', {
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
        messages: many2many('Message', {
            related: 'threadCache.messages',
        }),
        stringifiedDomain: attr({
            default: '[]',
        }),
        thread: many2one('Thread', {
            inverse: 'viewers',
        }),
        threadCache: many2one('ThreadCache', {
            compute: '_computeThreadCache',
            dependencies: [
                'stringifiedDomain',
                'thread',
                'threadCaches',
            ],
        }),
        threadCacheInitialPosition: attr({
            compute: '_computeThreadCacheInitialPosition',
            dependencies: [
                'threadCache',
                'threadCacheInitialScrollPositions',
            ],
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
        threadCaches: many2many('ThreadCache', {
            related: 'thread.caches',
        }),
        uncheckedMessages: many2many('Message', {
            related: 'threadCache.uncheckedMessages',
        }),
    };

    return ThreadViewer;
}

registerNewEntity('ThreadViewer', ThreadViewerFactory);

});
