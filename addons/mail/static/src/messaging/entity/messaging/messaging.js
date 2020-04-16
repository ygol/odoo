odoo.define('mail.messaging.entity.Messaging', function (require) {
'use strict';

const {
    fields: {
        attr,
        one2one,
    },
    registerNewEntity,
} = require('mail.messaging.entity.core');
const Field = require('mail.messaging.entity.Field');

function MessagingFactory({ Entity }) {

    class Messaging extends Entity {

        constructor(...args) {
            super(...args);
            /**
             * Contains all entity instances. key is local id, while value is
             * instance.
             */
            this.entityInstances = {};
            /**
             * Mark this entity as the messaging entity. Such entity acts as
             * the manager of all entities.
             */
            this.isMessaging = true;
            /**
             * Whether this is currently handling an "update after" on an entity.
             * Useful to determine if we should process computed/related fields.
             */
            this._isHandlingToUpdateAfters = false;
            /**
             * Determine whether an update cycle is currently in progress.
             * Useful to determine whether an update should initiate an update
             * cycle or not. An update cycle basically prioritizes processing
             * of all direct updates (i.e. explicit from `data`) before
             * processing computes.
             */
            this._isInUpdateCycle = false;
            /**
             * Fields flagged to call compute during an update cycle.
             * For instance, when a field with dependents got update, dependent
             * fields should update themselves by invoking compute at end of
             * update cycle.
             */
            this._toComputeFields = new Map();
            /**
             * List of "update after" on entities that have been registered.
             * These are processed after any explicit update and computed/related
             * fields.
             */
            this._toUpdateAfters = [];
        }

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        /**
         * Open the form view of the record with provided id and model.
         *
         * @param {Object} param0
         * @param {integer} param0.id
         * @param {string} param0.model
         */
        openDocument({ id, model }) {
            this.env.do_action({
                type: 'ir.actions.act_window',
                res_model: model,
                views: [[false, 'form']],
                res_id: id,
            });
            this.messagingMenu.close();
            this.env.messaging.chatWindowManager.closeAll();
        }

        /**
         * Process an update on provided entity with provided data. Updating
         * an entity consists of applying direct updates first (i.e. explicit
         * ones from `data`) and then indirect ones (i.e. compute/related fields
         * and "after updates").
         *
         * @param {mail.messaging.entity.Entity} entity
         * @param {Object} data
         * @param {Object} [param2]
         * @param {boolean} [param2.isJustCreated=false] whether this update to
         *   process is initiated from a creation of this entity or not. Newly
         *   created entity should have all its computed/related fields
         *   registered for compute during this update cycle.
         */
        processUpdate(entity, data, { isJustCreated = false } = {}) {
            if (!this._isInUpdateCycle) {
                this._isInUpdateCycle = true;
                this._processDirectUpdate(entity, data, { isJustCreated });
                while (
                    this._toComputeFields.size > 0 ||
                    this._toUpdateAfters.length > 0
                ) {
                    if (this._toComputeFields.size > 0) {
                        // process one compute field
                        this._processComputes();
                    } else {
                        this._isHandlingToUpdateAfters = true;
                        // process one update after
                        const [entity, previous] = this._toUpdateAfters.pop();
                        if (!entity.isDeleted) {
                            entity._updateAfter(previous);
                        }
                        this._isHandlingToUpdateAfters = false;
                    }
                }
                this._toComputeFields.clear();
                this._isInUpdateCycle = false;
            } else {
                this._processDirectUpdate(entity, data, { isJustCreated });
                if (this._isHandlingToUpdateAfters) {
                    this._processComputes();
                }
            }
        }

        /**
         * Handles redirection to a model and id. Try to handle it in the context
         * of messaging (e.g. open chat if this is a user), otherwise fallback to
         * opening form view of record.
         *
         * @param {Object} param0
         * @param {integer} param0.id
         * @param {string} param0.model
         * FIXME needs to be tested and maybe refactored (see task-2244279)
         */
        async redirect({ id, model }) {
            if (model === 'mail.channel') {
                const channel = this.env.entities.Thread.find(thread =>
                    thread.id === id &&
                    thread.model === 'mail.channel'
                );
                if (!channel || !channel.isPinned) {
                    this.env.entities.Thread.joinChannel(id, { autoselect: true });
                    return;
                }
                channel.open();
            } else if (model === 'res.partner') {
                if (id === this.currentPartner.id) {
                    this.openDocument({
                        model: 'res.partner',
                        id,
                    });
                    return;
                }
                const partner = this.env.entities.Partner.insert({ id });
                if (!partner.user) {
                    await partner.checkIsUser();
                }
                if (!partner.user) {
                    // partner is not a user, open document instead
                    this.openDocument({
                        model: 'res.partner',
                        id: partner.id,
                    });
                    return;
                }
                const chat = partner.directPartnerThread;
                if (!chat) {
                    this.env.entities.Thread.createChannel({
                        autoselect: true,
                        partnerId: id,
                        type: 'chat',
                    });
                    return;
                }
                chat.open();
            } else {
                this.openDocument({
                    model: 'res.partner',
                    id,
                });
            }
        }

        /**
         * @param {mail.messaging.entity.Entity} entity
         * @param {Object} [data]
         * @returns {mail.messaging.entity.Entity}
         */
        registerEntity(entity, data) {
            // Make state, which contain field values of entity that have to
            // be observed in store.
            this.env.store.state.entities[entity.localId] = {};
            entity.__state = this.env.store.state.entities[entity.localId];

            // Make proxified entity, so that access to field redirects
            // to field getter.
            const proxifiedEntity = this._makeProxifiedEntity(entity);
            this.entityInstances[entity.localId] = proxifiedEntity;
            entity.__fields = this._makeEntityFields(proxifiedEntity);

            const data2 = Object.assign({}, data);
            for (const field of Object.values(entity.constructor.fields)) {
                if (field.fieldType !== 'relation') {
                    continue;
                }
                if (!field.autocreate) {
                    continue;
                }
                data2[field.fieldName] = [['create']];
            }

            if (entity !== this) {
                this.processUpdate(proxifiedEntity, data2, { isJustCreated: true });
            }

            return proxifiedEntity;
        }

        /**
         * @param {mail.messaging.entity.Field} field
         */
        registerToComputeField(field) {
            this._toComputeFields.set(field.localId, field);
        }

        /**
         * Start messaging and related entities.
         */
        async start() {
            this.update({
                initializer: [['create']],
                notificationHandler: [['create']],
            });
            this._handleGlobalWindowFocus = this._handleGlobalWindowFocus.bind(this);
            this.env.call('bus_service', 'on', 'window_focus', null, this._handleGlobalWindowFocus);
            await this.initializer.start();
            this.notificationHandler.start();
            this.update({ isInitialized: true });
        }

        /**
         * Stop messaging and related entities.
         */
        stop() {
            this.env.call('bus_service', 'off', 'window_focus', null, this._handleGlobalWindowFocus);
            this.initializer.stop();
            this.notificationHandler.stop();
        }

        /**
         * @param {mail.messaging.entity.Entity} entity
         */
        unregisterEntity(entity) {
            delete this.entityInstances[entity.localId];
            delete this.env.store.state.entities[entity.localId];
        }

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * @privatete
         */
        _handleGlobalWindowFocus() {
            this.update({ outOfFocusUnreadMessageCounter: 0 });
            this.env.trigger_up('set_title_part', {
                part: '_chat',
            });
        }

        /**
         * @private
         * @param {mail.messaging.entity.Entity} entity
         */
        _makeEntityFields(entity) {
            const fields = {};
            for (const definition of Object.values(entity.constructor.fields)) {
                const field = new Field(entity, definition);
                fields[definition.fieldName] = field;
            }
            return fields;
        }

        /**
         * @private
         * @param {mail.messaging.entity.Entity} entity
         * @return {Proxy} proxified entity
         */
        _makeProxifiedEntity(entity) {
            const proxifiedEntity = new Proxy(entity, {
                get: (target, k) => {
                    if (k === 'constructor') {
                        return target[k];
                    }
                    const field = target.constructor.fields[k];
                    if (!field) {
                        return target[k];
                    }
                    return target.__fields[k].get();
                },
                set: (target, k, newVal) => {
                    if (target.constructor.fields[k]) {
                        throw new Error("Forbidden to write on entity field without .update()!!");
                    } else {
                        target[k] = newVal;
                    }
                    return true;
                },
            });
            return proxifiedEntity;
        }

        /**
         * @private
         */
        _processComputes() {
            while (this._toComputeFields.size > 0) {
                // process one compute field
                const fieldLocalId = this._toComputeFields.keys().next().value;
                const field = this._toComputeFields.get(fieldLocalId);
                this._toComputeFields.delete(fieldLocalId);
                if (!field.entity.isDeleted) {
                    field.compute();
                }
            }
        }

        /**
         * @private
         * @param {mail.messaging.entity.Entity} entity
         * @param {Object} data
         * @param {Object} [param2={}]
         * @param {boolean} [param2.isJustCreated=false] whether the current
         *   entity that is being updated has just been created.
         */
        _processDirectUpdate(entity, data, { isJustCreated = false } = {}) {
            if (isJustCreated) {
                for (const field of Object.values(entity.__fields)) {
                    if (field.definition.compute || field.definition.related) {
                        // new entity should always invoke compute fields.
                        this._toComputeFields.set(field.localId, field);
                    }
                }
            }
            const previous = entity._updateBefore();
            for (const [k, v] of Object.entries(data)) {
                const field = entity.constructor.fields[k];
                if (!field) {
                    throw new Error("Cannot create/update entity with data unrelated to a field.");
                }
                entity.__fields[k].set(v);
            }
            const existing = this._toUpdateAfters.find(entry => entry[0] === entity);
            if (!existing) {
                this._toUpdateAfters.push([entity, previous]);
            }
        }

    }

    Messaging.entityName = 'Messaging';

    Messaging.fields = {
        attachmentViewer: one2one('AttachmentViewer', {
            isCausal: true,
        }),
        cannedResponses: attr({
            default: {},
        }),
        chatWindowManager: one2one('ChatWindowManager', {
            isCausal: true,
        }),
        commands: attr({
            default: {},
        }),
        currentPartner: one2one('Partner'),
        device: one2one('Device', {
            isCausal: true,
        }),
        dialogManager: one2one('DialogManager', {
            isCausal: true,
        }),
        discuss: one2one('Discuss', {
            isCausal: true,
        }),
        initializer: one2one('MessagingInitializer', {
            isCausal: true,
        }),
        isInitialized: attr({
            default: false,
        }),
        locale: one2one('Locale', {
            isCausal: true,
        }),
        messagingMenu: one2one('MessagingMenu', {
            isCausal: true,
        }),
        notificationHandler: one2one('MessagingNotificationHandler', {
            isCausal: true,
        }),
        outOfFocusUnreadMessageCounter: attr({
            default: 0,
        }),
        partnerRoot: one2one('Partner'),
    };

    return Messaging;
}

registerNewEntity('Messaging', MessagingFactory);

});
