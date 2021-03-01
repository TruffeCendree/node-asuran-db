import { FieldForeignKey } from './model';
export default class Relation<T> {
    private baseModel;
    private _connection;
    private _ioSerialized;
    private _select;
    private _joins;
    private _includes;
    private _where;
    private _group;
    private _limit;
    private _order;
    private _proxify;
    constructor(baseModel: FieldForeignKey);
    includes(model: FieldForeignKey, path: string, tableAlias?: string, checkIoTs?: boolean): this;
    joins(sql: string, bindings?: any[]): this;
    where(sql: string, bindings?: any[]): this;
    whereIn(sql: string, values: any[]): this;
    whereId(id: number): this;
    whereIds(ids: number[]): this;
    whereNotIds(ids: number[]): this;
    find(id: number): Promise<T>;
    get none(): this;
    get withoutDependant(): this;
    findMany(ids: number[]): Promise<T[]>;
    group(by: string): this;
    sort(sql: string): this;
    limit(l: number): this;
    count(): Promise<any>;
    exists(): Promise<boolean>;
    toSql(): string;
    toExistsSql(): string;
    toBindings(): any[];
    /**
     * Same as toArray(), but skip some processing to improve performance.
     * - skip schema validation using ThrowReporter
     * - build simpler SQL that only select columns of main table
     * - skip jointure deserialization
     * - reduce memory allocations by reusing objets from mysql2 driver
     */
    toArrayFast(opts?: {
        noPrototype?: boolean;
    }): Promise<T[]>;
    toArray(): Promise<T[]>;
    pluck(columns: string[]): Promise<any[]>;
    first(): Promise<T>;
    proxify(relation: Relation<any>, basePath: string): this;
    unproxify(): Relation<any>;
    or(subqueries: Relation<any>[]): this;
    tap(cb: (self: this) => any): this;
    withConnection(connection: any): this;
}
