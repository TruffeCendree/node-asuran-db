"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const t = require("io-ts");
const ThrowReporter_1 = require("io-ts/lib/ThrowReporter");
const assert = require("assert");
class Relation {
    constructor(baseModel) {
        this.baseModel = baseModel;
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
    findMany(ids) {
        return __awaiter(this, void 0, void 0, function* () {
            const objects = yield this.whereIds(ids).toArray();
            assert(objects.length === ids.length, `Some ids ${ids.join(', ')} where not resolved.`);
            if (this._order)
                return objects;
            // remise des objets dans le bon ordre
            return ids.map(id => objects.find((_) => _.id === id));
        });
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
    count() {
        return __awaiter(this, void 0, void 0, function* () {
            const oldSelect = this._select;
            this._select = ['COUNT(*) AS count'];
            const sql = this.toSql();
            this._select = oldSelect;
            const [[{ count }]] = yield this.baseModel.connection.query(sql, this.toBindings());
            return count;
        });
    }
    exists() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.count()) > 0;
        });
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
    toArray() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [rows] = yield this.baseModel.connection.query(this.toSql(), this.toBindings());
                ThrowReporter_1.ThrowReporter.report(t.array(t.type(this._ioSerialized)).decode(rows));
                return rows.map(row => {
                    const object = new this.baseModel(row[`${this.baseModel.className}.id`], row[`${this.baseModel.className}.editCommitId`], row[`${this.baseModel.className}.editDate`], row[`${this.baseModel.className}.notes`]);
                    for (const field of this.baseModel.fields) {
                        object[field.name] = field.deserialize(row[`${this.baseModel.className}.${field.name}`]);
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
                            subObject[field.name] = field.deserialize(row[`${include.tableAlias}.${field.name}`]);
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
        });
    }
    first() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.limit(1).toArray())[0];
        });
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
}
exports.default = Relation;
