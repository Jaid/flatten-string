import isIterable from '#src/lib/isIterable.ts'
import isZeroLength from '#src/lib/isZeroLength.ts'

const concatenateStringsWith = (joiner: string, ...items: Array<unknown>): string => {
  let result = ''
  const processItem = (item: unknown) => {
    if (!item) {
      return
    }
    if (item === true) {
      return
    }
    if (isZeroLength(item)) {
      return
    }
    if (typeof item === 'object') {
      if (isIterable(item)) {
        for (const subItem of item) {
          processItem(subItem)
        }
      }
      return
    }
    if (result.length) {
      result += joiner
    }
    result += String(item) // eslint-disable-line typescript/no-base-to-string
  }
  for (const item of items) {
    processItem(item)
  }
  return result
}
const concatenateStrings = (...items: Array<unknown>): string => {
  return concatenateStringsWith('', items)
}
concatenateStrings.with = concatenateStringsWith
concatenateStrings.lines = (...items: Array<unknown>): string => {
  return concatenateStringsWith('\n', items)
}
concatenateStrings.paragraphs = (...items: Array<unknown>): string => {
  return concatenateStringsWith('\n\n', items)
}
concatenateStrings.spaced = (...items: Array<unknown>): string => {
  return concatenateStringsWith(' ', items)
}
concatenateStrings.colon = (...items: Array<unknown>): string => {
  return concatenateStringsWith(':', items)
}
concatenateStrings.comma = (...items: Array<unknown>): string => {
  return concatenateStringsWith(',', items)
}
concatenateStrings.list = (...items: Array<unknown>): string => {
  return concatenateStringsWith(', ', items)
}
concatenateStrings.zero = (...items: Array<unknown>): string => {
  return concatenateStringsWith('\0', items)
}
concatenateStrings.tab = (...items: Array<unknown>): string => {
  return concatenateStringsWith('\t', items)
}
export default concatenateStrings
