"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registredModels = void 0;
const t = require("io-ts");
const ThrowReporter_1 = require("io-ts/lib/ThrowReporter");
const io_ts_regex_1 = require("./io-ts-regex");
exports.registredModels = {};
function newModel({ className, connection }) {
    var _a;
    return _a = class DBSpecializedModel {
            constructor(id, editCommitId, editDate) {
                this.id = id;
                this.editCommitId = editCommitId;
                this.editDate = editDate;
            }
            // tslint:disable-next-line:no-empty
            static async onCreate(revisionMetadata) { }
            // tslint:disable-next-line:no-empty
            static async onUpdate(revisionMetadata) { }
            // tslint:disable-next-line:no-empty
            static async onDelete(revisionMetadata) { }
            static async create(bodies, commitId, { getId } = { getId: false }) {
                if (bodies.length === 0)
                    return getId ? [] : null;
                for (const body of bodies) {
                    body.editDate = Date.now();
                    body.editCommitId = commitId;
                }
                ThrowReporter_1.ThrowReporter.report(t.array(this.toIotsCreateBodyValidator()).decode(bodies));
                const filteredFields = this.fields.filter(f => f.createBody);
                const fields = ['`id`'].concat(filteredFields.map(f => '`' + f.name + '`').join(', '));
                const variables = bodies.map(_ => '(' + ['NULL'].concat(filteredFields.map(f => f.sqlSetter).join(', ')) + ')').join(', ');
                const bindings = bodies.map(body => filteredFields.map(f => f.serialize(body[f.name])))
                    .reduce((acc, curr) => acc.concat(curr), []);
                const sql = 'INSERT INTO `' + this.className + 'Revision` (' + fields + ') VALUES ' + variables;
                const [result] = await this.connection().query(sql, bindings);
                const revisionMetadata = { insertRevisionId: result.insertId, affectedRows: result.affectedRows };
                await this.onCreate(revisionMetadata);
                if (!getId)
                    return null;
                return this.getIdsOfResourcesFromRevisionMetadata(revisionMetadata);
            }
            static async getIdsOfResourcesFromRevisionMetadata({ insertRevisionId, affectedRows }) {
                const [rows] = await this.connection().query('SELECT id FROM `' + this.className + 'Revision` WHERE revisionId >= ? AND revisionId < ?', [insertRevisionId, insertRevisionId + affectedRows]);
                return rows.map((_) => _.id);
            }
            static async update(bodiesParam, commitId) {
                if (bodiesParam.length === 0)
                    return null;
                const bodies = await Promise.all(bodiesParam.map(async (bodyParam) => {
                    const body = Object.assign({}, await this.q.find(bodyParam.id), bodyParam);
                    body.editDate = Date.now();
                    body.editCommitId = commitId;
                    ThrowReporter_1.ThrowReporter.report(this.toIotsUpdateBodyValidator().decode(body));
                    return body;
                }));
                const fields = this.fields.map(f => '`' + f.name + '`').join(', ');
                const variables = bodies.map(_ => '(' + this.fields.map(f => f.sqlSetter).join(', ') + ')').join(', ');
                const bindings = bodies.map(body => this.fields.map(f => f.serialize(body[f.name])))
                    .reduce((acc, curr) => acc.concat(curr), []);
                const sql = 'INSERT INTO `' + this.className + 'Revision` (' + fields + ') VALUES ' + variables + '';
                const result = await this.connection().query(sql, bindings);
                const revisionMetadata = { insertRevisionId: result.insertId, affectedRows: result.affectedRows };
                await this.onUpdate(revisionMetadata);
                return result;
            }
            static async delete(ids, commitId) {
                if (ids.length === 0)
                    return null;
                const bodies = await this.q.findMany(ids);
                const fields = this.fields.map(f => '`' + f.name + '`').concat(['`deleteCommitId`', '`deleteDate`']).join(', ');
                const variables = bodies.map(body => '(' + this.fields.map(f => f.sqlSetter).concat(['?', 'FROM_UNIXTIME(? DIV 1000)']).join(', ') + ')');
                const bindings = bodies.map(body => this.fields.map(f => f.serialize(body[f.name])).concat([commitId, Date.now()]))
                    .reduce((acc, curr) => acc.concat(curr), []);
                const sql = 'INSERT INTO `' + this.className + 'Revision` (' + fields + ') VALUES ' + variables;
                const result = await this.connection().query(sql, bindings);
                const revisionMetadata = { insertRevisionId: result.insertId, affectedRows: result.affectedRows };
                await this.onDelete(revisionMetadata);
                return result;
            }
            static prepareField(field) {
                if (this.name === this.className)
                    exports.registredModels[this.name] = this;
                if (typeof field.iotsDeserializedValidator === 'undefined') {
                    field.iotsDeserializedValidator = field.iotsSerializedValidator;
                }
                if (typeof field.sqlGetter === 'undefined')
                    field.sqlGetter = '?';
                if (typeof field.sqlSetter === 'undefined')
                    field.sqlSetter = '?';
                if (typeof field.foreignKey === 'undefined')
                    field.foreignKey = null;
                if (typeof field.foreignKeyMutator === 'undefined')
                    field.foreignKeyMutator = '';
                if (typeof field.foreignKeyArray === 'undefined')
                    field.foreignKeyArray = false;
                if (typeof field.createBody === 'undefined')
                    field.createBody = true;
                if (typeof field.updateBody === 'undefined')
                    field.updateBody = true;
                return field;
            }
            static registerField(field) {
                const prepared = this.prepareField(field);
                this.fields.push(prepared);
                return prepared;
            }
            static registerFieldBoolean(name, nullable = false) {
                return this.registerField({
                    name,
                    type: 'tinyint(1) ' + (nullable ? '' : 'NOT') + ' NULL',
                    iotsSerializedValidator: nullable ? t.union([t.null, t.number]) : t.number,
                    iotsDeserializedValidator: nullable ? t.union([t.null, t.boolean]) : t.boolean,
                    deserialize: (_) => _ === null ? null : _ !== 0
                });
            }
            static registerFieldString(name, length, nullable = false) {
                return this.registerField({
                    name,
                    type: `varchar(${length}) ${nullable ? '' : 'NOT'} NULL`,
                    iotsSerializedValidator: nullable ? t.union([t.null, t.string]) : t.string
                });
            }
            static registerFieldForeignKey(name, foreignKey, nullable = false) {
                if (!foreignKey)
                    throw new Error('foreignKey model cannot be null');
                const iotsSerializedValidator = nullable ? t.union([t.null, t.number]) : t.number;
                return this.registerField({ name, type: `int(11) ${nullable ? '' : 'NOT'} NULL`, iotsSerializedValidator, foreignKey });
            }
            static registerFieldForeignKeyArray(name, foreignKey) {
                if (!foreignKey)
                    throw new Error('foreignKey model cannot be null');
                return this.registerField({
                    name,
                    type: 'text NOT NULL',
                    iotsSerializedValidator: t.string,
                    iotsDeserializedValidator: t.array(t.number),
                    serialize: (ids) => JSON.stringify(ids.filter(onlyUnique)),
                    deserialize: (str) => JSON.parse(str),
                    foreignKey,
                    foreignKeyArray: true,
                    sqlGetter: "(CONCAT('[', IFNULL((SELECT GROUP_CONCAT(foreignId) FROM `" + this.className + '_' + name + '` WHERE ownerId = `' + this.className + "`.`id` GROUP BY ownerId), ''), ']'))"
                });
            }
            static registerFieldInteger(name, nullable = false) {
                return this.registerField({
                    name,
                    type: 'int(11) ' + (nullable ? '' : 'NOT') + ' NULL',
                    iotsSerializedValidator: nullable ? t.union([t.null, t.number]) : t.number
                });
            }
            static registerFieldDecimal(name, length, decimals, nullable = false) {
                return this.registerField({
                    name,
                    type: `decimal(${length}, ${decimals}) ${nullable ? '' : 'NOT'} NULL`,
                    iotsSerializedValidator: nullable ? t.union([t.null, t.string]) : t.string,
                    iotsDeserializedValidator: nullable ? t.union([t.null, t.number]) : t.number,
                    serialize: (_) => _ === null ? null : _.toString(),
                    deserialize: (_) => _ === null ? null : Number(_)
                });
            }
            static registerFieldEnum(name, values, nullable = false) {
                const notNullType = t.union(values.map(_ => t.literal(_)));
                return this.registerField({
                    name,
                    type: `enum(${values.map(_ => "'" + _ + "'").join(',')}) ${nullable ? '' : 'NOT'} NULL`,
                    iotsSerializedValidator: nullable ? t.union([t.null, notNullType]) : notNullType
                });
            }
            static registerFieldDatetime(name, nullable = false) {
                return this.registerField({
                    name,
                    type: `datetime ${nullable ? '' : 'NOT'} NULL`,
                    iotsSerializedValidator: nullable ? t.union([t.null, t.number]) : t.number,
                    sqlGetter: 'UNIX_TIMESTAMP(?) * 1000',
                    sqlSetter: 'FROM_UNIXTIME(? DIV 1000)'
                });
            }
            static registerFieldJson(name, length, iotsDeserializedValidator) {
                return this.registerField({
                    name,
                    type: `VARCHAR(${length}) NOT NULL`,
                    iotsSerializedValidator: t.string,
                    iotsDeserializedValidator,
                    serialize: (_) => JSON.stringify(_),
                    deserialize: (_) => JSON.parse(_)
                });
            }
            static registerFieldRegex(name, length, nullable = false) {
                return this.registerField({
                    name,
                    type: `varchar(${length}) ${nullable ? '' : 'NOT'} NULL`,
                    iotsSerializedValidator: nullable ? t.union([t.null, io_ts_regex_1.RegexType]) : io_ts_regex_1.RegexType
                });
            }
            // retourne le SQL nécessaire pour créer les tables dans la DB
            static toSqlTables() {
                const comment = `-- ---------------------- ${this.className} ----------------------`;
                const revisionTableFields = this.fields
                    .map(f => '`' + f.name + '` ' + f.type)
                    .concat(this.revisionFields.map(f => '`' + f.name + '` ' + f.type))
                    .join(', \n');
                const revisionTable = 'CREATE TABLE `' + this.className + 'Revision` (\n' +
                    '`revisionId` int(11) NOT NULL,\n' + revisionTableFields +
                    '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
                const revisionTablePrimaryIndex = 'ALTER TABLE `' + this.className + 'Revision` ADD PRIMARY KEY (`revisionId`);';
                const revisionTableAutoInc = 'ALTER TABLE `' + this.className + 'Revision` CHANGE `revisionId` `revisionId` INT(11) NOT NULL AUTO_INCREMENT;';
                const fastTableFields = this.fields.filter(_ => !_.foreignKeyArray).map(f => '`' + f.name + '` ' + f.type).join(', \n');
                const fastTable = 'CREATE TABLE `' + this.className + '` (\n' + fastTableFields + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
                const fastTablePrimaryIndex = 'ALTER TABLE `' + this.className + '` ADD PRIMARY KEY (`id`);';
                const fastTableAutoInc = 'ALTER TABLE `' + this.className + '` CHANGE `id` `id` INT(11) NOT NULL AUTO_INCREMENT;';
                const sql = [
                    comment, revisionTable, revisionTablePrimaryIndex, revisionTableAutoInc,
                    fastTable, fastTablePrimaryIndex, fastTableAutoInc
                ];
                const foreignKeysArray = this.fields.filter(_ => _.foreignKey !== null && _.foreignKeyArray);
                for (const foreignKeyArray of foreignKeysArray) {
                    sql.push('CREATE TABLE `' + this.className + '_' + foreignKeyArray.name + '` (ownerId INT(11) NOT NULL, foreignId INT(11) NOT NULL);');
                    sql.push('ALTER TABLE `' + this.className + '_' + foreignKeyArray.name + '`\n' +
                        'ADD FOREIGN KEY (ownerId) REFERENCES `' + this.className + '`(`id`),\n' +
                        'ADD FOREIGN KEY (foreignId) REFERENCES `' + foreignKeyArray.foreignKey.className + '`(`id`);');
                }
                sql.push(...this.extraDdl);
                const foreignKeys = this.fields.filter(_ => _.foreignKey !== null && _.foreignKeyArray === false);
                const fastForeignKeys = 'ALTER TABLE `' + this.className + '`\n' +
                    foreignKeys.map(f => 'ADD FOREIGN KEY (`' + f.name + '`) REFERENCES `' + f.foreignKey.className + '`(`id`) ' + f.foreignKeyMutator).join(',\n') + ';';
                if (foreignKeys.length)
                    sql.push(fastForeignKeys);
                return sql.join('\n\n');
            }
            static toSqlTriggers() {
                const deletePreviousTrigger = `DROP TRIGGER IF EXISTS before_insert_${this.className.toLowerCase()}_revision;`;
                const triggerClearPreviousArrays = this.fields.filter(_ => _.foreignKey !== null && _.foreignKeyArray).map(field => {
                    return 'DELETE FROM `' + this.className + '_' + field.name + '` WHERE ownerId = NEW.id;';
                });
                const triggerInsertArrays = this.fields.filter(_ => _.foreignKey !== null && _.foreignKeyArray).map(field => {
                    return `
          SET i = 0;
          WHILE i < JSON_LENGTH(NEW.${field.name}) DO
            INSERT INTO \`${this.className}_${field.name}\` (ownerId, foreignId) VALUES (NEW.id, JSON_EXTRACT(NEW.${field.name}, CONCAT('$[',i,']')));
            SET i = i + 1;
          END WHILE;
        `;
                });
                const triggerSql = `
        CREATE TRIGGER before_insert_${this.className.toLowerCase()}_revision
        BEFORE INSERT ON ${this.className}Revision FOR EACH ROW BEGIN
          DECLARE i INT DEFAULT 0;

          IF NEW.id IS NULL THEN
            INSERT INTO \`${this.className}\` (${this.fields.filter(f => f.name !== 'id' && !f.foreignKeyArray).map(f => '\`' + f.name + '\`').join(', ')})
            VALUES (${this.fields.filter(f => f.name !== 'id' && !f.foreignKeyArray).map(f => 'NEW.' + f.name).join(', ')});

            SET NEW.id = LAST_INSERT_ID();
          ELSEIF (SELECT count(*) FROM \`${this.className}\` WHERE id = NEW.id) = 0 THEN
            INSERT INTO \`${this.className}\` (${this.fields.filter(f => !f.foreignKeyArray).map(f => '\`' + f.name + '\`').join(', ')})
            VALUES (${this.fields.filter(f => !f.foreignKeyArray).map(f => 'NEW.' + f.name).join(', ')});
          ELSE
            UPDATE \`${this.className}\`
            SET ${this.fields.filter(f => f.name !== 'id' && !f.foreignKeyArray).map(f => '\`' + f.name + '\` = NEW.' + f.name).join(', ')}
            WHERE id = NEW.id;
          END IF;

          ${triggerClearPreviousArrays.join('\n')}

          IF NEW.deleteCommitId IS NOT NULL AND NEW.deleteDate IS NOT NULL THEN
            DELETE FROM \`${this.className}\` WHERE id = NEW.id;
          ${triggerInsertArrays.length ? 'ELSE' : ''}
            ${triggerInsertArrays.join('\n')}
          END IF;
        END;
      `;
                return deletePreviousTrigger + '\n' + triggerSql;
            }
            static toIotsCreateBodyValidator() {
                const attrs = {};
                for (const f of this.fields) {
                    if (f.createBody)
                        attrs[f.name] = f.iotsDeserializedValidator;
                }
                return t.exact(t.type(attrs));
            }
            static toIotsUpdateBodyValidator() {
                const attrs = {};
                for (const f of this.fields) {
                    if (f.updateBody)
                        attrs[f.name] = f.iotsDeserializedValidator;
                }
                return t.intersection([t.type({ id: t.number }), t.partial(attrs)]);
            }
            static toIotsSerializedValidator(exclude) {
                const attrs = {};
                for (const f of this.fields) {
                    if (exclude.includes(f.name))
                        continue;
                    const asName = this.className[0].toLocaleLowerCase() + this.className.substring(1) + '.' + f.name;
                    attrs[asName] = f.iotsSerializedValidator;
                }
                return t.type(attrs);
            }
            /** Produit l'expression pour générer un diagramme UML sur dbdiagram.io */
            static toDbDiagramIoTable() {
                const fields = this.fields.filter(_ => _.name !== 'id' && _.name !== 'editCommitId' && _.name !== 'editDate')
                    .map(_ => `${_.name} ${_.type.split(' ')[0].split('(')[0]}`).join('\n');
                return `Table ${this.className} {\nid int PK\n${fields}\n}`;
            }
            /** Produit l'expression pour générer un diagramme UML sur dbdiagram.io */
            static toDbDiagramIoRef() {
                return this.fields.filter(_ => _.foreignKey !== null)
                    .map(_ => `Ref : ${this.className}.${_.name} > ${_.foreignKey.className}.id`).join('\n');
            }
            static getForeigns() {
                return this.fields.filter(_ => _.foreignKey).map(_ => _.foreignKey).filter(onlyUnique);
            }
            only(fields) {
                const partialCopy = {};
                for (const field of fields)
                    partialCopy[field] = this[field];
                return partialCopy;
            }
            except(fields) {
                const partialCopy = {};
                for (const field in this) {
                    if (field !== 'jointure' && !fields.includes(field)) {
                        partialCopy[field] = this[field];
                    }
                }
                return partialCopy;
            }
        },
        _a.className = className,
        _a.connection = connection,
        _a.fields = [
            _a.prepareField({
                name: 'id',
                type: 'int(11) NOT NULL',
                iotsSerializedValidator: t.number,
                createBody: false
            }),
            _a.prepareField({
                name: 'editCommitId',
                type: 'int(11) NOT NULL',
                iotsSerializedValidator: t.number,
                updateBody: false
            }),
            _a.prepareField({
                name: 'editDate',
                type: 'datetime NOT NULL DEFAULT current_timestamp()',
                iotsSerializedValidator: t.number,
                sqlGetter: 'UNIX_TIMESTAMP(?) * 1000',
                sqlSetter: 'FROM_UNIXTIME(? DIV 1000)',
                updateBody: false
            })
        ],
        _a.revisionFields = [
            _a.prepareField({
                name: 'deleteCommitId',
                type: 'int(11) DEFAULT NULL',
                iotsSerializedValidator: t.union([t.null, t.number])
            }),
            _a.prepareField({
                name: 'deleteDate',
                type: 'datetime DEFAULT NULL',
                iotsSerializedValidator: t.number,
                sqlGetter: 'UNIX_TIMESTAMP(?) * 1000',
                sqlSetter: 'FROM_UNIXTIME(? DIV 1000)'
            })
        ],
        _a.extraDdl = [],
        _a;
}
exports.default = newModel;
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}
