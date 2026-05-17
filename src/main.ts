import isIterable from '#src/lib/isIterable.ts'
import isZeroLength from '#src/lib/isZeroLength.ts'

const flattenStringWith = (joiner: string, ...items: Array<unknown>): string => {
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
const flattenString = (...items: Array<unknown>): string => {
  return flattenStringWith('', items)
}
flattenString.with = flattenStringWith
flattenString.lines = (...items: Array<unknown>): string => {
  return flattenStringWith('\n', items)
}
flattenString.paragraphs = (...items: Array<unknown>): string => {
  return flattenStringWith('\n\n', items)
}
flattenString.spaced = (...items: Array<unknown>): string => {
  return flattenStringWith(' ', items)
}
flattenString.colon = (...items: Array<unknown>): string => {
  return flattenStringWith(':', items)
}
flattenString.comma = (...items: Array<unknown>): string => {
  return flattenStringWith(',', items)
}
flattenString.list = (...items: Array<unknown>): string => {
  return flattenStringWith(', ', items)
}
flattenString.zero = (...items: Array<unknown>): string => {
  return flattenStringWith('\0', items)
}
flattenString.tab = (...items: Array<unknown>): string => {
  return flattenStringWith('\t', items)
}
export default flattenString
