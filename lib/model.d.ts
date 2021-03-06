import * as t from 'io-ts';
declare type NeverFunc<T> = Pick<T, {
    [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T]>;
export declare type BodyCreate<T> = NeverFunc<Pick<T, Exclude<keyof T, 'id' | 'editCommitId' | 'editDate' | 'jointure'>>>;
export declare type BodyEdit<T> = NeverFunc<{
    id: number;
} & Partial<Pick<T, Exclude<keyof T, 'editCommitId' | 'editDate' | 'jointure'>>>>;
export declare type BodyPartial<T> = NeverFunc<Partial<Pick<T, Exclude<keyof T, 'id' | 'editCommitId' | 'editDate' | 'jointure'>>>>;
export declare type RevisionMetadata = {
    insertRevisionId: number;
    affectedRows: number;
};
export interface IGetAll {
    where?: {
        sql: string;
        bindings: any[];
    };
    semesterOrders?: {
        start: number;
        end: number;
    };
    exclude?: string[];
    logger?: boolean;
}
export interface FieldForeignKey {
    className: string;
    connection: Function;
    fields: Field[];
    toIotsSerializedValidator(exclude: string[]): t.TypeC<any>;
    getForeigns: () => FieldForeignKey[];
}
export interface Field {
    name: string;
    type: string;
    iotsSerializedValidator: t.Type<any>;
    iotsDeserializedValidator?: t.Type<any>;
    sqlGetter?: string;
    sqlSetter?: string;
    serialize?: (_: any) => any;
    deserialize?: (_: any) => any;
    foreignKey?: FieldForeignKey;
    foreignKeyMutator?: string;
    foreignKeyArray?: boolean;
    createBody?: boolean;
    updateBody?: boolean;
}
interface ModelOptions {
    className: string;
    connection: Function;
}
export declare const registredModels: {
    [className: string]: FieldForeignKey;
};
export default function newModel<T>({ className, connection }: ModelOptions): {
    new (id: number, editCommitId: number, editDate: number): {
        id: number;
        editCommitId: number;
        editDate: number;
        only(fields: string[]): any;
        except(fields: string[]): any;
    };
    className: string;
    connection: Function;
    fields: Field[];
    readonly revisionFields: Field[];
    readonly extraDdl: string[];
    onCreate(revisionMetadata: RevisionMetadata): Promise<void>;
    onUpdate(revisionMetadata: RevisionMetadata): Promise<void>;
    onDelete(revisionMetadata: RevisionMetadata): Promise<void>;
    create(bodies: BodyCreate<T>[], commitId: number, { getId, conn }?: {
        getId?: boolean;
        conn?: any;
    }): Promise<number[]>;
    getIdsOfResourcesFromRevisionMetadata({ insertRevisionId, affectedRows }: RevisionMetadata, conn?: any): Promise<number[]>;
    update(bodiesParam: BodyEdit<T>[], commitId: number, conn?: any): Promise<any>;
    delete(ids: number[], commitId: number, conn?: any): Promise<any>;
    prepareField(field: Field): Field;
    registerField(field: Field): Field;
    registerFieldBoolean(name: string, nullable?: boolean): Field;
    registerFieldString(name: string, length: number, nullable?: boolean): Field;
    registerFieldForeignKey(name: string, foreignKey: FieldForeignKey, nullable?: boolean): Field;
    registerFieldForeignKeyArray(name: string, foreignKey: FieldForeignKey): Field;
    registerFieldInteger(name: string, nullable?: boolean): Field;
    registerFieldDecimal(name: string, length: number, decimals: number, nullable?: boolean): Field;
    registerFieldEnum(name: string, values: string[], nullable?: boolean): Field;
    registerFieldDatetime(name: string, nullable?: boolean): Field;
    registerFieldJson(name: string, length: number, iotsDeserializedValidator: t.Type<any>): Field;
    registerFieldRegex(name: string, length: number, nullable?: boolean): Field;
    toSqlTables(): string;
    toSqlTriggers(): string;
    toIotsCreateBodyValidator(): t.ExactC<t.TypeC<any>>;
    toIotsUpdateBodyValidator(): t.IntersectionC<[t.TypeC<{
        id: t.NumberC;
    }>, t.PartialC<any>]>;
    toIotsSerializedValidator(exclude: string[]): t.TypeC<any>;
    /** Produit l'expression pour générer un diagramme UML sur dbdiagram.io */
    toDbDiagramIoTable(): string;
    /** Produit l'expression pour générer un diagramme UML sur dbdiagram.io */
    toDbDiagramIoRef(): string;
    getForeigns(): FieldForeignKey[];
};
export {};
