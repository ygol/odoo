odoo.define('mail.messaging.entity.Entity', function (require) {
'use strict';

const {
    fields: {
        many2one,
    },
    registerNewEntity,
} = require('mail.messaging.entity.core');

function EntityFactory() {

    class Entity {

        /**
         * @param {mail.messaging.messagin_env} env
         * @param {any} data
         */
        constructor(env, data) {
            this.env = env;
            this.isDeleted = false;
            this.isEntity = true;
            this.localId = this._createInstanceLocalId(data);
        }

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        /**
         * Returns all instance entities of this entity class that match
         * provided criteria.
         *
         * @static
         * @param {function} [filterFunc]
         * @returns {mail.messaging.entity.Entity[]}
         */
        static all(filterFunc) {
            const allEntities = Object.values(this.env.messaging.entityInstances)
                .filter(e => e instanceof this);
            if (filterFunc) {
                return allEntities.filter(filterFunc);
            }
            return allEntities;
        }

        /**
         * This method is used to create new entity instances of this class
         * with provided data. This is the only way to create them:
         * instantiation must never been done with keyword `new` outside of this
         * function, otherwise the instance entity will not be registered.
         *
         * @static
         * @param {Object} [data={}] data object with initial data, including relations.
         * @returns {mail.messaging.entity.Entity} newly created entity
         */
        static create(data = {}) {
            const entity = new this(this.env, data);
            const proxifiedEntity = entity.isMessaging
                ? entity.registerEntity(entity, data)
                : this.env.messaging.registerEntity(entity, data);
            return proxifiedEntity;
        }

        /**
         * Get the instance entity that has provided criteria, if it exists.
         *
         * @static
         * @param {function} findFunc
         * @returns {mail.messaging.entity.Entity|undefined}
         */
        static find(findFunc) {
            return this.all().find(findFunc);
        }

        /**
         * This method returns the entity of this class that matches provided
         * local id. Useful to convert a local id to an entity. Note that even
         * if there's a entity in the system having provided local id, if the
         * resulting entity is not an instance of this class, this getter
         * assumes the entity does not exist.
         *
         * @static
         * @param {string|mail.messaging.entity.Entity|undefined} entityOrLocalId
         * @returns {mail.messaging.entity.Entity|undefined}
         */
        static get(entityOrLocalId) {
            if (entityOrLocalId === undefined) {
                return undefined;
            }
            const entity = this.env.messaging.entityInstances[
                entityOrLocalId.isEntity
                    ? entityOrLocalId.localId
                    : entityOrLocalId
            ];
            if (!(entity instanceof this) && entity !== this) {
                return;
            }
            return entity;
        }

        /**
         * This method creates an instance entity or updates one, depending
         * on provided data. This method assumes that instance entities are
         * uniquely identifiable per their `id` data.
         *
         * @static
         * @param {Object} data
         * @returns {mail.messaging.entity.Entity} created or updated entity.
         */
        static insert(data) {
            let entity = this.find(this._findFunctionFromData(data));
            if (!entity) {
                entity = this.create(data);
            } else {
                entity.update(data);
            }
            return entity;
        }

        /**
         * @static
         * @returns {Object[]}
         */
        static get relations() {
            return Object.values(this.fields)
                .filter(field => field.fieldType === 'relation');
        }

        /**
         * This method deletes this instance entity. After this operation, it's
         * as if this entity never existed. Note that relation are removed,
         * which may delete more relations if some of them are causal.
         */
        delete() {
            if (!this.constructor.get(this)) {
                // Entity has already been deleted.
                // (e.g. unlinking one of its reverse relation was causal)
                return;
            }
            const data = {};
            for (const relation of this.constructor.relations) {
                if (relation.isCausal) {
                    switch (relation.relationType) {
                        case 'one2one':
                        case 'many2one':
                            if (this[relation.fieldName]) {
                                this[relation.fieldName].delete();
                            }
                            break;
                        case 'one2many':
                        case 'many2many':
                            for (const relatedEntity of this[relation.fieldName]) {
                                relatedEntity.delete();
                            }
                            break;
                    }
                }
                data[relation.fieldName] = [['unlink-all']];
            }
            this.update(data);
            this.isDeleted = true;
            this.env.messaging.unregisterEntity(this);
        }

        /**
         * Update this instance entity with provided data.
         *
         * @param {Object} [data={}]
         */
        update(data = {}) {
            this.env.messaging.processUpdate(this, data);
        }

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * @static
         * @private
         * @param {Object} data
         * @param {any} data.id
         * @return {function}
         */
        static _findFunctionFromData(data) {
            return entity => entity.id === data.id;
        }

        /**
         * @private
         * @returns {mail.messaging.entity.Messaging}
         */
        _computeMessaging() {
            return [['link', this.env.messaging]];
        }

        /**
         * This method generates a local id for this instance entity that is
         * being created at the moment.
         *
         * This function helps customizing the local id to ease mapping a local
         * id to its entity for the developer that reads the local id. For
         * instance, the local id of a thread cache could combine the thread
         * and stringified domain in its local id, which is much easier to
         * track relations and entities in the system instead of arbitrary
         * number to differenciate them.
         *
         * @private
         * @param {Object} data
         * @returns {string}
         */
        _createInstanceLocalId(data) {
            return _.uniqueId(`${this.constructor.entityName}_`);
        }

        /**
         * @abstract
         * @private
         * @param {Object} previous
         */
        _updateAfter(previous) {}

        /**
         * @abstract
         * @private
         * @param {Object} data
         */
        _updateBefore() {}

    }

    /**
     * Name of the entity class. Important to refer to appropriate entity class
     * like in relational fields. Name of entity classes must be unique.
     */
    Entity.entityName = 'Entity';
    /**
     * Entity classes should define fields in static prop or getter `field`.
     * It contains an object with name of field as key and value are objects
     * that define the field. There are some helpers to ease the making of these
     * objects, @see `mail.messaging.entity.core.fields`
     *
     * Note: fields of super-class are automatically inherited, therefore a
     * sub-class should (re-)define fields without copying ancestors' fields.
     */
    Entity.fields = {
        messaging: many2one('Messaging', {
            compute: '_computeMessaging',
        }),
    };

    return Entity;
}

registerNewEntity('Entity', EntityFactory);

});
