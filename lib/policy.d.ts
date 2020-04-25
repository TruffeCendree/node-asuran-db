import { BodyEdit } from './model';
export default class Policy {
    protected whitelist<T>(fields: string[], body: BodyEdit<T>): boolean;
}
