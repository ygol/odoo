odoo.define('mail/static/src/models/thread_viewer/thread_viewer_container.js', function (require) {
'use strict';

const { registerNewModel } = require('mail/static/src/model/model_core.js');
const { attr, many2one, one2one } = require('mail/static/src/model/model_field.js');

function factory(dependencies) {

    class ThreadViewerContainer extends dependencies['mail.model'] {

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        /**
         * @param {mail.thread_cache} threadCache
         * @param {string} scrollTop
         */
        saveThreadCacheScrollPositionsAsInitial(threadCache, scrollTop) {
            this.update({
                threadCacheInitialScrollPositions: Object.assign({}, this.threadCacheInitialScrollPositions, {
                    [threadCache.localId]: scrollTop,
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
         * @returns{mail.thread_viewer|undefined}
         */
        _computeThreadViewer() {
            if (!this.hasThreadViewer) {
                return [['unlink']];
            }
            if (this.threadViewer) {
                return [];
            }
            return [['create']];
        }

    }

    ThreadViewerContainer.fields = {
        /**
         * Determine whether the current thread viewer should be displayed.
         *
         * This field should be controlled by the record which created this
         * container, and it should otherwise be considered read-only.
         */
        hasThreadViewer: attr(),
        /**
         * Domain to apply when fetching messages for the current thread.
         *
         * This field should be controlled by the record which created this
         * container, and it should otherwise be considered read-only.
         */
        stringifiedDomain: attr({
            default: '[]',
        }),
        /**
         * Thread currently displayed by this thread viewer.
         *
         * This field should be controlled by the record which created this
         * container, and it should otherwise be considered read-only.
         */
        thread: many2one('mail.thread'),
        /**
         * List of saved initial scroll positions of thread caches.
         * Useful to restore scroll position on changing back to this
         * thread cache. Note that this is only applied when opening
         * the thread cache, because scroll position may change fast so
         * save is already throttled.
         */
        threadCacheInitialScrollPositions: attr({
            default: {},
        }),
        /**
         * Thread viewer currently displayed and controlled by this container.
         */
        threadViewer: one2one('mail.thread_viewer', {
            compute: '_computeThreadViewer',
            dependencies: [
                'hasThreadViewer',
            ],
            inverse: 'container',
            isCausal: true,
        }),
    };

    ThreadViewerContainer.modelName = 'mail.thread_viewer_container';

    return ThreadViewerContainer;
}

registerNewModel('mail.thread_viewer_container', factory);

});
