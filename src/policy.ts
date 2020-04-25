import { BodyEdit } from './model'
import debug from 'debug'

export default class Policy {
  protected whitelist<T> (fields: string[], body: BodyEdit<T>) {
    for (const field in body) {
      if (field !== 'id' && !fields.includes(field)) {
        debug('asr:policy')(`BodyEdit<T>.${field} has not been whitelisted for that profile`)
        return false
      }
    }

    return true
  }
}
