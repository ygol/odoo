odoo.define('mail.messaging.entity.MessagingInitializer', function (require) {
'use strict';

const {
    fields: {
        one2one,
    },
    registerNewEntity,
} = require('mail.messaging.entity.core');

function MessagingInitializerFactory({ Entity }) {

    class MessagingInitializer extends Entity {

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        /**
         * Fetch messaging data initially to populate the store specifically for
         * the current user. This includes pinned channels for instance.
         */
        async start() {
            await this.constructor._start(this);
        }

        /**
         * Called when messaging is stopped.
         */
        stop() {
            if (this.messaging.device) {
                this.messaging.device.stop();
            }
        }

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * Static method in order to be patched.
         *
         * @static
         * @private
         * @param {mail.messaging.entity.MessagingInitializer} messagingInitializer
         */
        static async _start(messagingInitializer) {
            await this.env.session.is_bound;

            this.env.entities.Thread.create({
                id: 'inbox',
                isPinned: true,
                model: 'mail.box',
                name: this.env._t("Inbox"),
            });
            this.env.entities.Thread.create({
                id: 'starred',
                isPinned: true,
                model: 'mail.box',
                name: this.env._t("Starred"),
            });
            this.env.entities.Thread.create({
                id: 'history',
                isPinned: true,
                model: 'mail.box',
                name: this.env._t("History"),
            });

            messagingInitializer.messaging.update({
                attachmentViewer: [['create']],
                chatWindowManager: [['create']],
                device: [['create']],
                dialogManager: [['create']],
                discuss: [['create']],
                locale: [['create']],
                messagingMenu: [['create']],
            });

            const device = this.env.messaging.device;
            device.start();
            const context = Object.assign({
                isMobile: device.isMobile,
            }, this.env.session.user_context);
            const discuss = this.env.messaging.discuss;
            const data = await this.env.rpc({
                route: '/mail/init_messaging',
                params: { context: context }
            });
            messagingInitializer._init(data);
            if (discuss.isOpen) {
                discuss.openInitThread();
            }
            if (this.env.autofetchPartnerImStatus) {
                this.env.entities.Partner.startLoopFetchImStatus();
            }
        }

        /**
         * @private
         * @param {Object} param0
         * @param {Object} param0.channel_slots
         * @param {Array} [param0.commands=[]]
         * @param {boolean} [param0.is_moderator=false]
         * @param {Object} [param0.mail_failures={}]
         * @param {Object[]} [param0.mention_partner_suggestions=[]]
         * @param {Object[]} [param0.moderation_channel_ids=[]]
         * @param {integer} [param0.moderation_counter=0]
         * @param {integer} [param0.needaction_inbox_counter=0]
         * @param {Array} param0.partner_root
         * @param {Object[]} [param0.shortcodes=[]]
         * @param {integer} [param0.starred_counter=0]
         */
        _init({
            channel_slots,
            commands = [],
            is_moderator = false,
            mail_failures = {},
            mention_partner_suggestions = [],
            menu_id,
            moderation_channel_ids = [],
            moderation_counter = 0,
            needaction_inbox_counter = 0,
            partner_root,
            shortcodes = [],
            starred_counter = 0
        }) {
            const discuss = this.env.messaging.discuss;
            this._initPartners(partner_root);
            this._initChannels({
                channel_slots,
                moderation_channel_ids,
            });
            this._initCommands(commands);
            this._initMailboxes({
                is_moderator,
                moderation_counter,
                needaction_inbox_counter,
                starred_counter,
            });
            this._initMailFailures(mail_failures);
            this._initCannedResponses(shortcodes);
            this._initMentionPartnerSuggestions(mention_partner_suggestions);
            discuss.update({ menu_id });
        }

        /**
         * @private
         * @param {Object[]} shortcodes
         */
        _initCannedResponses(shortcodes) {
            const messaging = this.env.messaging;
            const cannedResponses = shortcodes
                .map(s => {
                    const { id, source, substitution } = s;
                    return { id, source, substitution };
                })
                .reduce((obj, cr) => {
                    obj[cr.id] = cr;
                    return obj;
                }, {});
            messaging.update({ cannedResponses });
        }

        /**
         * @private
         * @param {Object} param0
         * @param {Object} param0.channel_slots
         * @param {Object[]} [param0.channel_slots.channel_channel=[]]
         * @param {Object[]} [param0.channel_slots.channel_direct_message=[]]
         * @param {Object[]} [param0.channel_slots.channel_livechat=[]]
         * @param {Object[]} [param0.channel_slots.channel_private_group=[]]
         * @param {integer[]} [param0.moderation_channel_ids=[]]
         */
        _initChannels({
            channel_slots: {
                channel_channel = [],
                channel_direct_message = [],
                // AKU FIXME: should be patch in im_livechat
                channel_livechat = [],
                channel_private_group = [],
            },
            moderation_channel_ids = [],
        }) {
            // AKU FIXME: before any creation of channel/thread because this is
            // used for computed field `isModeratedByUser`.
            this.env.entities.Thread.moderatedChannelIds = moderation_channel_ids;
            for (const data of channel_channel.concat(channel_direct_message, channel_livechat, channel_private_group)) {
                this.env.entities.Thread.insert(Object.assign(
                    {},
                    this.env.entities.Thread.convertData(data),
                    {
                        isPinned: true,
                        model: 'mail.channel',
                    }
                ));
            }
        }

        /**
         * @private
         * @param {Object[]} commandsData
         */
        _initCommands(commandsData) {
            const messaging = this.env.messaging;
            const commands = commandsData
                .map(command => {
                    return Object.assign({
                        id: command.name,
                    }, command);
                })
                .reduce((obj, command) => {
                    obj[command.id] = command;
                    return obj;
                }, {});
            messaging.update({ commands });
        }

        /**
         * @private
         * @param {Object} param0
         * @param {boolean} param0.is_moderator
         * @param {integer} param0.moderation_counter
         * @param {integer} param0.needaction_inbox_counter
         * @param {integer} param0.starred_counter
         */
        _initMailboxes({
            is_moderator,
            moderation_counter,
            needaction_inbox_counter,
            starred_counter,
        }) {
            const inbox = this.env.entities.Thread.find(thread =>
                thread.id === 'inbox' &&
                thread.model === 'mail.box'
            );
            const starred = this.env.entities.Thread.find(thread =>
                thread.id === 'starred' &&
                thread.model === 'mail.box'
            );
            inbox.update({ counter: needaction_inbox_counter });
            starred.update({ counter: starred_counter });
            if (is_moderator) {
                this.env.entities.Thread.create({
                    counter: moderation_counter,
                    id: 'moderation',
                    isPinned: true,
                    model: 'mail.box',
                    name: this.env._t("Moderation"),
                });
            }
        }

        /**
         * @private
         * @param {Object} mailFailuresData
         */
        _initMailFailures(mailFailuresData) {
            for (const data of Object.values(mailFailuresData)) {
                // TODO
            }
        }

        /**
         * @private
         * @param {Object[]} mentionPartnerSuggestionsData
         */
        _initMentionPartnerSuggestions(mentionPartnerSuggestionsData) {
            for (const suggestions of mentionPartnerSuggestionsData) {
                for (const suggestion of suggestions) {
                    const { email, id, name } = suggestion;
                    this.env.entities.Partner.insert({ email, id, name });
                }
            }
        }

        /**
         * @private
         * @param {Array} param0 partner root name get
         * @param {integer} param0[0] partner root id
         * @param {string} param0[1] partner root display_name
         */
        _initPartners([partnerRootId, partnerRootDisplayName]) {
            this.messaging.update({
                currentPartner: [['insert', {
                    display_name: this.env.session.partner_display_name,
                    id: this.env.session.partner_id,
                    name: this.env.session.name,
                    user: [['insert', { id: this.env.session.uid }]],
                }]],
                partnerRoot: [['insert', {
                    display_name: partnerRootDisplayName,
                    id: partnerRootId,
                }]],
            });
        }

    }

    MessagingInitializer.entityName = 'MessagingInitializer';

    return MessagingInitializer;
}

registerNewEntity('MessagingInitializer', MessagingInitializerFactory);

});
