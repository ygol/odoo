odoo.define('mail/static/src/models/messaging/messaging.js', function (require) {
'use strict';

const { registerNewModel } = require('mail/static/src/model/model_core.js');
const { attr, many2one, one2one } = require('mail/static/src/model/model_field.js');

function factory(dependencies) {

    class Messaging extends dependencies['mail.model'] {

        /**
         * @override
         */
        delete() {
            this.env.services['bus_service'].off('window_focus', null, this._handleGlobalWindowFocus);
            super.delete();
        }

        /**
         * Starts messaging and related records.
         */
        async start() {
            this._handleGlobalWindowFocus = this._handleGlobalWindowFocus.bind(this);
            this.env.services['bus_service'].on('window_focus', null, this._handleGlobalWindowFocus);
            await this.async(() => this.initializer.start());
            this.notificationHandler.start();
            this.update({ isInitialized: true });
        }

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        /**
         * Gets the canonical chat with the provided person and returns it.
         *
         * If a chat is not appropriate a notification is displayed instead.
         *
         * @param {Object} param0
         * @param {integer} [param0.partnerId]
         * @param {integer} [param0.userId]
         * @param {Object} [options]
         * @returns {mail.thread|undefined}
         */
        async getCanonicalChat({ partnerId, userId }) {
            if (userId) {
                const user = this.env.models['mail.user'].insert({ id: userId });
                return user.getCanonicalChat();
            }
            if (partnerId) {
                const partner = this.env.models['mail.partner'].insert({ id: partnerId });
                return partner.getCanonicalChat();
            }
        }

        /**
         * Opens a chat with the provided person and returns it.
         *
         * If a chat is not appropriate a notification is displayed instead.
         *
         * @param {Object} person forwarded to @see `getCanonicalChat()`
         * @param {Object} [options] forwarded to @see `mail.thread:open()`
         * @returns {mail.thread|undefined}
         */
        async openChat(person, options) {
            const chat = await this.async(() => this.getCanonicalChat(person));
            if (!chat) {
                return;
            }
            await this.async(() => chat.open(options));
            return chat;
        }

        /**
         * Opens the form view of the record with provided id and model.
         *
         * @param {Object} param0
         * @param {integer} param0.id
         * @param {string} param0.model
         */
        async openDocument({ id, model }) {
            this.env.bus.trigger('do-action', {
                action: {
                    type: 'ir.actions.act_window',
                    res_model: model,
                    views: [[false, 'form']],
                    res_id: id,
                },
            });
            if (this.env.messaging.device.isMobile) {
                // messaging menu has a higher z-index than views so it must
                // be closed to ensure the visibility of the view
                this.env.messaging.messagingMenu.close();
            }
        }

        /**
         * Opens the most appropriate view that is a profile for provided id and
         * model.
         *
         * @param {Object} param0
         * @param {integer} param0.id
         * @param {string} param0.model
         */
        async openProfile({ id, model }) {
            if (model === 'res.partner') {
                const partner = this.env.models['mail.partner'].insert({ id });
                return partner.openProfile();
            }
            if (model === 'res.users') {
                const user = this.env.models['mail.user'].insert({ id });
                return user.openProfile();
            }
            if (model === 'mail.channel') {
                let channel = this.env.models['mail.thread'].findFromIdentifyingData({ id, model: 'mail.channel' });
                if (!channel) {
                    channel = (await this.async(() =>
                        this.env.models['mail.thread'].performRpcChannelInfo({ ids: [id] })
                    ))[0];
                }
                return channel.openProfile();
            }
            return this.env.messaging.openDocument({ id, model });
        }

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * @private
         */
        _handleGlobalWindowFocus() {
            this.update({ outOfFocusUnreadMessageCounter: 0 });
            this.env.bus.trigger('set_title_part', {
                part: '_chat',
            });
        }

    }

    Messaging.fields = {
        cannedResponses: attr({
            default: {},
        }),
        chatWindowManager: one2one('mail.chat_window_manager', {
            default: [['create']],
            inverse: 'messaging',
            isCausal: true,
        }),
        commands: attr({
            default: {},
        }),
        currentPartner: one2one('mail.partner'),
        currentUser: one2one('mail.user'),
        device: one2one('mail.device', {
            default: [['create']],
            isCausal: true,
        }),
        dialogManager: one2one('mail.dialog_manager', {
            default: [['create']],
            isCausal: true,
        }),
        discuss: one2one('mail.discuss', {
            default: [['create']],
            inverse: 'messaging',
            isCausal: true,
        }),
        /**
         * Mailbox History.
         */
        history: one2one('mail.thread'),
        /**
         * Mailbox Inbox.
         */
        inbox: one2one('mail.thread'),
        initializer: one2one('mail.messaging_initializer', {
            default: [['create']],
            inverse: 'messaging',
            isCausal: true,
        }),
        isInitialized: attr({
            default: false,
        }),
        locale: one2one('mail.locale', {
            default: [['create']],
            isCausal: true,
        }),
        messagingMenu: one2one('mail.messaging_menu', {
            default: [['create']],
            inverse: 'messaging',
            isCausal: true,
        }),
        /**
         * Mailbox Moderation.
         */
        moderation: one2one('mail.thread'),
        notificationGroupManager: one2one('mail.notification_group_manager', {
            default: [['create']],
            isCausal: true,
        }),
        notificationHandler: one2one('mail.messaging_notification_handler', {
            default: [['create']],
            inverse: 'messaging',
            isCausal: true,
        }),
        outOfFocusUnreadMessageCounter: attr({
            default: 0,
        }),
        partnerRoot: many2one('mail.partner'),
        publicPartner: many2one('mail.partner'),
        /**
         * Mailbox Starred.
         */
        starred: one2one('mail.thread'),
    };

    Messaging.modelName = 'mail.messaging';

    return Messaging;
}

registerNewModel('mail.messaging', factory);

});
