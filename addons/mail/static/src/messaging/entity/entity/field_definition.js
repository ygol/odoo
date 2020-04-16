odoo.define('mail.messaging.entity.FieldDefinition', function (require) {
'use strict';

class FieldDefinition {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    constructor({
        autocreate = false,
        compute,
        default: def,
        dependencies = [],
        dependents = [],
        fieldName,
        fieldType,
        hashes: extraHashes = [],
        inverse,
        isCausal = false,
        related,
        relationType,
        to,
    } = {}) {
        const id = _.uniqueId('fieldDefinition_');
        /**
         * This prop only makes sense for fields of type "relation". If set,
         * it automatically creates a new entity for this field on creation of
         * entity, and auto-links with this entity.
         */
        this.autocreate = autocreate;
        /**
         * If set, this field acts as a computed field, and this prop
         * contains the name of the instance method that computes the value
         * for this field. This compute method is called on creation of entity
         * and whenever some of its dependencies change. @see dependencies
         */
        this.compute = compute;
        /**
         * Default value for this field. Used on creation of this field, to
         * set a value by default.
         */
        this.default = def;
        /**
         * List of field on current entity that this field depends on for its
         * `compute` method. Useful to determine whether this field should be
         * registered for recomputation when some entity fields have changed.
         * This list must be declared in entity definition, or compute method
         * is only computed once.
         */
        this.dependencies = dependencies;
        /**
         * List of fields that are dependent of this field. They should never
         * be declared, and are automatically generated while normalizing
         * fields. This is populated by compute `dependencies` and `related`.
         */
        this.dependents = dependents;
        /**
         * Name of the field in the definition of fields on entity.
         */
        this.fieldName = fieldName;
        /**
         * Type of this field. 2 types of fields are currently supported:
         *
         *   1. 'attribute': fields that store primitive values like integers,
         *                   booleans, strings, objects, array, etc.
         *
         *   2. 'relation': fields that relate to some other entities.
         *
         * Rule of thumb is to always use 'relation' when possible.
         */
        this.fieldType = fieldType;
        /**
         * List of hashes registered on this field definition. Technical
         * prop that is specifically used in processing of dependent
         * fields, useful to clearly identify which fields of a relation are
         * dependents and must be registered for computed. Indeed, not all
         * related entities may a field that depends on changed field,
         * especially when dependency is defined on sub-entity on a relation in
         * a super-entity.
         */
        this.hashes = extraHashes.concat([id]);
        /**
         * Identification for this field definition. Useful to map a dependent
         * from a dependency. Indeed, declared field definitions use
         * 'dependencies' but technical process need inverse as 'dependents'.
         * Dependencies just need name of fields, but dependents cannot just
         * rely on inverse field names because these dependents are a subset.
         */
        this.id = id;
        /**
         * This prop only makes sense in a relational field. This contains
         * the name of the field name in the inverse relation. This may not
         * be defined in declared field definitions, but reconciled relational
         * field definitions always have inverses.
         */
        this.inverse = inverse;
        /**
         * This prop only makes in a relational field. If set, when this
         * relation is removed, the related entity is automatically deleted.
         */
        this.isCausal = isCausal;
        /**
         * If set, this field acts as a related field, and this prop contains
         * a string that references the related field. It should have the
         * following format: '<relationName>.<relatedFieldName>', where
         * <relationName> is a relational field name on this entity or a parent
         * entity (note: could itself be computed or related), and
         * <relatedFieldName> is the name of field on the entities that are
         * related to current entity from this relation. When there are more
         * than one entity in the relation, it maps all related fields per
         * entity in relation.
         */
        this.related = related;
        /**
         * This prop only makes sense in a relational field. Determine which
         * type of relation there is between current entity and other entities.
         * 4 types of relation are supported: 'one2one', 'one2many', 'many2one'
         * and 'many2many'.
         */
        this.relationType = relationType;
        /**
         * This prop only makes sense in a relational field. Determine which
         * entity name this relation refers to.
         */
        this.to = to;
    }

    /**
     * @param {mail.messaging.entity.FieldDefinition} fieldDefinition
     * @returns {mail.messaging.entity.FieldDefinition}
     */
    reconcile(fieldDefinition) {
        return new FieldDefinition(Object.assign({}, this, {
            hashes: this.hashes.concat(fieldDefinition.hashes),
        }));
    }
}

return FieldDefinition;

});
