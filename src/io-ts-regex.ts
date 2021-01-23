import * as t from 'io-ts'

export const RegexType = new t.Type<string, string>(
  'RegexType',
  (input): input is string => typeof input === 'string',
  (input, context) => {
    if (typeof input !== 'string') return t.failure(input, context)
    try {
      new RegExp(input) // tslint:disable-line
      return t.success(input)
    } catch (err) {
      return t.failure(input, context)
    }
  },
  a => a
)
