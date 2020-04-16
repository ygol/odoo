odoo.define('mail.messaging.entity.core', function (require) {
'use strict';

const FieldDefinition = require('mail.messaging.entity.FieldDefinition');
const { patchClassMethods, patchInstanceMethods } = require('mail.messaging.utils');

const registry = {};

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

/**
 * @private
 * @param {Object} Entities
 * @throws {Error} in case some relations are not correct
 */
function _checkFields(Entities) {
    for (const Entity of Object.values(Entities)) {
        for (const fieldName in Entity.fields) {
            const field = Entity.fields[fieldName];
            if (!(['attribute', 'relation'].includes(field.fieldType))) {
                throw new Error(`Field "${Entity.entityName}/${fieldName}" has unsupported type ${field.fieldType}.`);
            }
            if (field.compute && field.related) {
                throw new Error(`Field "${Entity.entityName}/${fieldName}" cannot be a related and compute field at the same time.`);
            }
            if (field.fieldType === 'attribute') {
                continue;
            }
            if (!field.relationType) {
                throw new Error(
                    `Field "${Entity.entityName}/${fieldName}" must define a relation type in "relationType".`
                );
            }
            if (!(['one2one', 'one2many', 'many2one', 'many2many'].includes(field.relationType))) {
                throw new Error(
                    `Field "${Entity.entityName}/${fieldName}" has invalid relation type "${field.relationType}".`
                );
            }
            if (!field.inverse) {
                throw new Error(
                    `Field "${
                        Entity.entityName
                    }/${
                        fieldName
                    }" must define an inverse relation name in "inverse".`
                );
            }
            if (!field.to) {
                throw new Error(
                    `Relation "${
                        Entity.entityName
                    }/${
                        fieldName
                    }" must define an Entity class name in "relationTo" (1st positional parameter of relation field helpers).`
                );
            }
            const RelatedEntity = Entities[field.to];
            if (!RelatedEntity) {
                throw new Error(
                    `Entity class name of relation "${Entity.entityName}/${fieldName}" does not exist.`
                );
            }
            const inverseField = RelatedEntity.fields[field.inverse];
            if (!inverseField) {
                throw new Error(
                    `Relation entity class "${
                        Entity.entityName
                    }/${
                        fieldName
                    }" has no inverse field "${RelatedEntity.entityName}/${field.inverse}".`
                );
            }
            const allSelfAndParentNames = [];
            let target = Entity;
            while (target) {
                allSelfAndParentNames.push(target.entityName);
                target = target.__proto__;
            }
            if (!allSelfAndParentNames.includes(inverseField.to)) {
                throw new Error(
                    `Relation "${
                        Entity.entityName
                    }/${
                        fieldName
                    }" has inverse relation "${
                        RelatedEntity.entityName
                    }/${
                        field.inverse
                    }" misconfigured (currently "${
                        inverseField.to
                    }", should instead refer to this entity or parented entity: ${
                        allSelfAndParentNames.map(name => `"${name}"`).join(', ')
                    }?)`
                );
            }
            if (
                (field.relationType === 'many2many' && inverseField.relationType !== 'many2many') ||
                (field.relationType === 'one2one' && inverseField.relationType !== 'one2one') ||
                (field.relationType === 'one2many' && inverseField.relationType !== 'many2one') ||
                (field.relationType === 'many2one' && inverseField.relationType !== 'one2many')
            ) {
                throw new Error(
                    `Mismatch relations types "${
                        Entity.entityName
                    }/${
                        fieldName
                    }" (${
                        field.relationType
                    }) and "${
                        RelatedEntity.entityName
                    }/${
                        field.inverse
                    }" (${
                        inverseField.relationType
                    }).`
                );
            }
        }
    }
}

/**
 * @private
 * @param {string} entityName
 * @returns {Object}
 */
function _getEntryFromEntityName(entityName) {
    if (!registry[entityName]) {
        registry[entityName] = {
            dependencies: [],
            factory: undefined,
            name: entityName,
            patches: [],
        };
    }
    return registry[entityName];
}

/**
 * @private
 * @param {mail.messaging.entity.Entity} Entity class
 * @param {Object} field
 * @returns {Object}
 */
function _inverseRelation(Entity, field) {
    const relFunc =
         field.relationType === 'many2many' ? many2many
        : field.relationType === 'many2one' ? one2many
        : field.relationType === 'one2many' ? many2one
        : field.relationType === 'one2one' ? one2one
        : undefined;
    if (!relFunc) {
        throw new Error(`Cannot compute inverse Relation of "${Entity.entityName}/${field.fieldName}".`);
    }
    const inverseField = relFunc(Entity.entityName, { inverse: field.fieldName });
    inverseField.fieldName = `_inverse_${Entity.entityName}/${field.fieldName}`;
    return inverseField;
}

/**
 * This function normalize definition of fields in provided entities.
 * Basically, entities have fields declared in static prop `fields`, and this
 * function processes and modifies them in place so that they are fully
 * configured. For instance, entity relations need bi-directional mapping, but
 * inverse relation may be omitted in declared field: this function auto-fill
 * this inverse relation.
 *
 * @private
 * @param {Object} Entities
 */
function _normalizeFields(Entities) {
    /**
     * 1. Prepare fields.
     */
    for (const Entity of Object.values(Entities)) {
        if (!Entity.hasOwnProperty('fields')) {
            Entity.fields = {};
        }
        Entity.inverseRelations = [];
        // Make fields aware of their field name.
        for (const [fieldName, field] of Object.entries(Entity.fields)) {
            field.fieldName = fieldName;
        }
    }
    /**
     * 2. Auto-generate definitions of undeclared inverse relations.
     */
    for (const Entity of Object.values(Entities)) {
        for (const field of Object.values(Entity.fields)) {
            if (field.fieldType !== 'relation') {
                continue;
            }
            if (field.inverse) {
                continue;
            }
            const RelatedEntity = Entities[field.to];
            const inverseField = _inverseRelation(Entity, field);
            field.inverse = inverseField.fieldName;
            RelatedEntity.fields[inverseField.fieldName] = inverseField;
        }
    }
    /**
     * 3. Generate dependents and inverse-relates on fields.
     */
    for (const Entity of Object.values(Entities)) {
        for (const field of Object.values(Entity.fields)) {
            for (const dependencyFieldName of field.dependencies) {
                let TargetEntity = Entity;
                let dependencyField = TargetEntity.fields[dependencyFieldName];
                while (!dependencyField) {
                    TargetEntity = TargetEntity.__proto__;
                    dependencyField = TargetEntity.fields[dependencyFieldName];
                }
                dependencyField.dependents = [
                    ...new Set(
                        dependencyField.dependents.concat(
                            [`${field.id}.${field.fieldName}`]
                        )
                    )
                ];
            }
            if (field.related) {
                const [relationName, relatedFieldName] = field.related.split('.');
                let TargetEntity = Entity;
                let relationField = TargetEntity.fields[relationName];
                while (!relationField) {
                    TargetEntity = TargetEntity.__proto__;
                    relationField = TargetEntity.fields[relationName];
                }
                relationField.dependents = [
                    ...new Set(
                        relationField.dependents.concat(
                            [`${field.id}.${field.fieldName}`]
                        )
                    )
                ];
                const OtherEntity = Entities[relationField.to];
                let OtherTargetEntity = OtherEntity;
                let relatedField = OtherTargetEntity.fields[relatedFieldName];
                while (!relatedField) {
                    OtherTargetEntity = OtherEntity.__proto__;
                    relatedField = OtherTargetEntity.fields[relatedFieldName];
                }
                relatedField.dependents = [
                    ...new Set(
                        relatedField.dependents.concat(
                            [`${field.id}.${relationField.inverse}.${field.fieldName}`]
                        )
                    )
                ];
            }
        }
    }
    /**
     * 4. Extend definition of fields of an entity with the definition of
     * fields of its parents. Field definitions on self has precedence over
     * parented fields.
     */
    for (const Entity of Object.values(Entities)) {
        Entity.__reconciledFields = {};
        for (const field of Object.values(Entity.fields)) {
            Entity.__reconciledFields[field.fieldName] = field;
        }
        let TargetEntity = Entity.__proto__;
        while (TargetEntity && TargetEntity.fields) {
            for (const targetField of Object.values(TargetEntity.fields)) {
                const field = Entity.__reconciledFields[targetField.fieldName];
                if (field) {
                    Entity.__reconciledFields[targetField.fieldName] = field.reconcile(targetField);
                } else {
                    Entity.__reconciledFields[targetField.fieldName] = targetField;
                }
            }
            TargetEntity = TargetEntity.__proto__;
        }
    }
    for (const Entity of Object.values(Entities)) {
        Entity.fields = Entity.__reconciledFields;
        delete Entity.__reconciledFields;
    }
}

/**
 * @private
 * @param {string} entityName
 * @param {string} patchName
 * @param {Object} patch
 * @param {Object} [param3={}]
 * @param {string} [param3.type='instance'] 'instance', 'class' or 'field'
 */
function _registerPatchEntity(entityName, patchName, patch, { type = 'instance' } = {}) {
    const entry = _getEntryFromEntityName(entityName);
    Object.assign(entry, {
        patches: (entry.patches || []).concat([{
            name: patchName,
            patch,
            type,
        }]),
    });
}

/**
 * Define a relation
 *
 * @private
 * @param {string} entityClassName
 * @param {Object} options
 * @returns {Object}
 */
function _relation(entityClassName, options) {
    return new FieldDefinition(
        Object.assign({
            fieldType: 'relation',
            to: entityClassName,
        }, options)
    );
}

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

/**
 * @param {Object} [options]
 * @returns {Object}
 */
function attr(options) {
    return new FieldDefinition(
        Object.assign({
            fieldType: 'attribute',
        }, options)
    );
}

/**
 * @returns {Object}
 */
function generateEntities() {
    const allNames = Object.keys(registry);
    const Entities = {};
    const generatedNames = [];
    let toGenerateNames = [...allNames];
    while (toGenerateNames.length > 0) {
        const generatable = toGenerateNames.map(name => registry[name]).find(entry => {
            let isGenerateable = true;
            for (const dependencyName of entry.dependencies) {
                if (!generatedNames.includes(dependencyName)) {
                    isGenerateable = false;
                }
            }
            return isGenerateable;
        });
        if (!generatable) {
            throw new Error(`Cannot generate following Entity classes: ${toGenerateNames.split(', ')}`);
        }
        const Entity = generatable.factory(Entities);
        for (const patch of generatable.patches) {
            switch (patch.type) {
                case 'class':
                    patchClassMethods(Entity, patch.name, patch.patch);
                    break;
                case 'instance':
                    patchInstanceMethods(Entity, patch.name, patch.patch);
                    break;
                case 'field':
                    Object.assign(Entity.fields, patch.patch);
                    break;
            }
        }
        Entities[Entity.entityName] = Entity;
        generatedNames.push(Entity.entityName);
        toGenerateNames = toGenerateNames.filter(name => name !== Entity.entityName);
    }
    /**
     * Normalize entity fields definitions. For instance, every relations should
     * have an inverse, even if auto-generated.
     */
    _normalizeFields(Entities);
    /**
     * Check that all entity fields are correct, notably one relation
     * should have matching reversed relation.
     */
    _checkFields(Entities);
    return Entities;
}

/**
 * Define a many2many field
 *
 * @param {string} entityClassName
 * @param {Object} [options]
 * @returns {Object}
 */
function many2many(entityClassName, options) {
    return _relation(entityClassName, Object.assign({}, options, { relationType: 'many2many' }));
}

/**
 * Define a many2one field
 *
 * @param {string} entityClassName
 * @param {Object} [options]
 * @returns {Object}
 */
function many2one(entityClassName, options) {
    return _relation(entityClassName, Object.assign({}, options, { relationType: 'many2one' }));
}

/**
 * Define a one2many field
 *
 * @param {string} entityClassName
 * @param {Object} [options]
 * @returns {Object}
 */
function one2many(entityClassName, options) {
    return _relation(entityClassName, Object.assign({}, options, { relationType: 'one2many' }));
}

/**
 * Define a one2one field
 *
 * @param {string} entityClassName
 * @param {Object} [options]
 * @returns {Object}
 */
function one2one(entityClassName, options) {
    return _relation(entityClassName, Object.assign({}, options, { relationType: 'one2one' }));
}

/**
 *
 * @param {string} entityName
 * @param {string} patchName
 * @param {Object} patch
 */
function registerClassPatchEntity(entityName, patchName, patch) {
    _registerPatchEntity(entityName, patchName, patch, { type: 'class' });
}

/**
 *
 * @param {string} entityName
 * @param {string} patchName
 * @param {Object} patch
 */
function registerFieldPatchEntity(entityName, patchName, patch) {
    _registerPatchEntity(entityName, patchName, patch, { type: 'field' });
}

/**
 * FIXME: instance patch are not supported due to patch making changes on
 * entity property `_super` each time such a patched method is called, thus
 * incrementing rev number and results in infinite loops.
 * Work-around is to patch class methods, since classes are not observed due
 * to them being functions (and functions are not observed).
 *
 * @param {string} entityName
 * @param {string} patchName
 * @param {Object} patch
 */
function registerInstancePatchEntity(entityName, patchName, patch) {
    throw new Error(`Cannot apply instance entity patch "${
        patchName
    }": Instance patches on entities are not supported. Use class patch instead.`);
    // _registerPatchEntity(entityName, patchName, patch, { isOnClass: false });
}

/**
 * @param {string} name
 * @param {function} factory
 * @param {string[]} [dependencies=[]]
 */
function registerNewEntity(name, factory, dependencies = []) {
    const entry = _getEntryFromEntityName(name);
    let entryDependencies = [...dependencies];
    if (name !== 'Entity') {
        entryDependencies = [...new Set(entryDependencies.concat(['Entity']))];
    }
    if (entry.factory) {
        throw new Error(`Entity class "${name}" has already been registered!`);
    }
    Object.assign(entry, {
        dependencies: entryDependencies,
        factory,
        name,
    });
}

//------------------------------------------------------------------------------
// Export
//------------------------------------------------------------------------------

return {
    fields: {
        attr,
        many2many,
        many2one,
        one2many,
        one2one,
    },
    generateEntities,
    registerClassPatchEntity,
    registerFieldPatchEntity,
    registerInstancePatchEntity,
    registerNewEntity,
};

});
