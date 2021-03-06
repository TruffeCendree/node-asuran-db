"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const t = require("io-ts");
const model_1 = require("./model");
const ThrowReporter_1 = require("io-ts/lib/ThrowReporter");
const assert = require("assert");
class Relation {
    constructor(baseModel) {
        this.baseModel = baseModel;
        this._connection = this.baseModel.connection();
        this._ioSerialized = {};
        this._select = [];
        this._joins = [];
        this._includes = [];
        this._where = [];
        this._proxify = { relation: null, basePath: '' };
        this.includes(this.baseModel, null, this.baseModel.className, true);
        this._order = '`' + this.baseModel.className + '`.`id`';
    }
    includes(model, path, tableAlias = model.className, checkIoTs = false) {
        if (path) {
            // the path of resulting jointure is a unique key and we deduplicate multiple inclusion of same object at the path.
            const includePath = this._proxify.basePath + path;
            const existing = this._includes.find(_ => _.path === includePath);
            if (existing)
                return this;
            this._includes.push({ model, path: includePath, tableAlias });
        }
        for (const field of model.fields) {
            const alias = tableAlias + '.' + field.name;
            this._select.push(field.sqlGetter.replace('?', '`' + tableAlias + '`.`' + field.name + '`') + ' AS `' + alias + '`');
            if (checkIoTs)
                this._ioSerialized[alias] = field.iotsSerializedValidator;
        }
        return this;
    }
    joins(sql, bindings = []) {
        // JOIN must be properly formated and not included many times (same for includes)
        const existing = this._joins.find(join => join.sql === sql && JSON.stringify(join.bindings) === JSON.stringify(bindings));
        if (!existing)
            this._joins.push({ sql, bindings });
        return this;
    }
    where(sql, bindings = []) {
        this._where.push({ sql, bindings });
        return this;
    }
    whereIn(sql, values) {
        if (!values.length)
            return this.where('FALSE');
        return this.where(`${sql} IN (${values.map(_ => '?').join(', ')})`, values);
    }
    whereId(id) {
        return this.where('`' + this.baseModel.className + '`.`id` = ?', [id]);
    }
    whereIds(ids) {
        return this.whereIn('`' + this.baseModel.className + '`.`id`', ids);
    }
    whereNotIds(ids) {
        if (!ids.length)
            return this.where('TRUE');
        return this.where('`' + this.baseModel.className + '`.`id`' + ` NOT IN (${ids.map(_ => '?').join(', ')})`, ids);
    }
    find(id) {
        return this.whereId(id).first();
    }
    get none() {
        return this.where('FALSE');
    }
    get withoutDependant() {
        // regular foreign keys
        for (const className in model_1.registredModels) {
            const onClause = model_1.registredModels[className].fields
                .filter(_ => _.foreignKey === this.baseModel && !_.foreignKeyArray)
                .map(_ => '`' + className + '`.`' + _.name + '` = `' + this.baseModel.className + '`.`id`')
                .join(' OR ');
            if (!onClause.length)
                continue;
            this.joins('LEFT JOIN `' + className + '` ON ' + onClause);
            this.where('`' + className + '`.`id` IS NULL');
        }
        // foreign arrays
        for (const className in model_1.registredModels) {
            for (const field of model_1.registredModels[className].fields) {
                if (field.foreignKey === this.baseModel && field.foreignKeyArray) {
                    this.joins('LEFT JOIN `' + className + '_' + field.name + '` ON `' + className + '_' + field.name + '`.`foreignId` = `' + this.baseModel.className + '`.`id`');
                    this.where('`' + className + '_' + field.name + '`.`foreignId` IS NULL');
                }
            }
        }
        return this;
    }
    async findMany(ids) {
        const objects = await this.whereIds(ids).toArray();
        const missingIds = ids.filter(id => !objects.find((_) => _.id === id));
        assert(!missingIds.length, `Some ids where not resolved. Missing ids are ${missingIds.join(', ')}.`);
        assert(objects.length === ids.length, `The returned count differs from query (${objects.length} found, ${ids.length} required).`);
        if (this._order)
            return objects;
        // remise des objets dans le bon ordre
        return ids.map(id => objects.find((_) => _.id === id));
    }
    group(by) {
        this._group = by;
        return this;
    }
    sort(sql) {
        this._order = sql;
        return this;
    }
    limit(l) {
        this._limit = l;
        return this;
    }
    async count() {
        const oldSelect = this._select;
        this._select = ['COUNT(*) AS count'];
        const sql = this.toSql();
        this._select = oldSelect;
        const [[{ count }]] = await this._connection.query(sql, this.toBindings());
        return count;
    }
    async exists() {
        return await this.count() > 0;
    }
    toSql() {
        return `SELECT ${this._select.join(', ')} FROM \`${this.baseModel.className}\` ${this._joins.map(_ => _.sql).join(' ')} ${this._where.length ? 'WHERE' : ''} ${this._where.map(_ => '(' + _.sql + ')').join(' AND ')} ${this._group ? 'GROUP BY ' + this._group : ''} ${this._order ? 'ORDER BY ' + this._order : ''} ${this._limit ? 'LIMIT ' + this._limit : ''}`;
    }
    toExistsSql() {
        this._select = ['`' + this.baseModel.className + '`.id'];
        this._group = null;
        this._order = null;
        this._limit = 1;
        return this.toSql();
    }
    toBindings() {
        return this._joins.map(_ => _.bindings).reduce((acc, curr) => acc.concat(curr), [])
            .concat(this._where.map(_ => _.bindings).reduce((acc, curr) => acc.concat(curr), []));
    }
    /**
     * Same as toArray(), but skip some processing to improve performance.
     * - skip schema validation using ThrowReporter
     * - build simpler SQL that only select columns of main table
     * - skip jointure deserialization
     * - reduce memory allocations by reusing objets from mysql2 driver
     */
    async toArrayFast(opts = {}) {
        if (this._where.find(_ => _.sql === 'FALSE'))
            return [];
        try {
            const oldSelect = this._select;
            // this._select = ['`' + this.baseModel.className + '`.*']
            this._select = this.baseModel.fields.map(field => field.sqlGetter.replace('?', '`' + this.baseModel.className + '`.`' + field.name + '`') + ' AS `' + field.name + '`');
            const [rows] = await this._connection.query(this.toSql(), this.toBindings());
            this._select = oldSelect;
            const fieldsRequiringDeserialization = this.baseModel.fields.filter(_ => _.deserialize);
            for (const row of rows) {
                if (!opts.noPrototype)
                    Object.setPrototypeOf(row, this.baseModel.prototype);
                for (const field of fieldsRequiringDeserialization)
                    row[field.name] = field.deserialize(row[field.name]);
            }
            return rows;
        }
        catch (err) {
            err.sql = this.toSql();
            err.bindings = this.toBindings();
            throw err;
        }
    }
    async toArray() {
        if (this._where.find(_ => _.sql === 'FALSE'))
            return [];
        try {
            const [rows] = await this._connection.query(this.toSql(), this.toBindings());
            ThrowReporter_1.ThrowReporter.report(t.array(t.type(this._ioSerialized)).decode(rows));
            return rows.map(row => {
                const object = new this.baseModel(row[`${this.baseModel.className}.id`], row[`${this.baseModel.className}.editCommitId`], row[`${this.baseModel.className}.editDate`], row[`${this.baseModel.className}.notes`]);
                for (const field of this.baseModel.fields) {
                    object[field.name] = field.deserialize ? field.deserialize(row[`${this.baseModel.className}.${field.name}`]) : row[`${this.baseModel.className}.${field.name}`];
                }
                object.jointure = {};
                for (const include of this._includes) {
                    if (row[`${include.tableAlias}.id`] === null)
                        continue;
                    const path = include.path.split('.').slice(1);
                    let subObject = object;
                    for (let i = 0; i < path.length - 1; i++) {
                        if (!subObject[path[i]])
                            subObject[path[i]] = {};
                        subObject = subObject[path[i]];
                    }
                    subObject[path[path.length - 1]] = new include.model(row[`${include.tableAlias}.id`], row[`${include.tableAlias}.editCommitId`], row[`${include.tableAlias}.editDate`], row[`${include.tableAlias}.notes`]);
                    subObject = subObject[path[path.length - 1]];
                    subObject.jointure = {};
                    for (const field of include.model.fields) {
                        subObject[field.name] = field.deserialize ? field.deserialize(row[`${include.tableAlias}.${field.name}`]) : row[`${include.tableAlias}.${field.name}`];
                    }
                }
                return object;
            });
        }
        catch (err) {
            err.sql = this.toSql();
            err.bindings = this.toBindings();
            throw err;
        }
    }
    async pluck(columns) {
        if (this._where.find(_ => _.sql === 'FALSE'))
            return [];
        this._select = columns;
        const [rows] = await this._connection.query(this.toSql(), this.toBindings());
        return rows.map(row => columns.length === 1 ? Object.values(row)[0] : Object.values(row));
    }
    async first() {
        return (await this.limit(1).toArray())[0];
    }
    proxify(relation, basePath) {
        this._proxify = { relation, basePath: relation._proxify.basePath + basePath };
        this._ioSerialized = relation._ioSerialized;
        this._select = relation._select;
        this._joins = relation._joins;
        this._includes = relation._includes;
        this._where = relation._where;
        return this;
    }
    unproxify() { return this._proxify.relation; }
    or(subqueries) {
        let sql = [];
        let bindings = [];
        for (const subquery of subqueries) {
            for (const join of subquery._joins)
                this.joins(join.sql, join.bindings);
            sql.push(subquery._where.map(_ => `(${_.sql})`).join(' AND '));
            bindings.push(...subquery._where.map(_ => _.bindings).reduce((acc, curr) => acc.concat(curr), []));
        }
        return this.where(sql.map(_ => `(${_})`).join(' OR '), bindings);
    }
    tap(cb) {
        cb(this);
        return this;
    }
    withConnection(connection) {
        this._connection = connection;
        return this;
    }
}
exports.default = Relation;
