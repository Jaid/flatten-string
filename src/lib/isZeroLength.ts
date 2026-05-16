export default (value: NonNullable<unknown>): value is {length: 0} => {
  if (!['string', 'object'].includes(typeof value)) {
    return false
  }
  if (Object.hasOwn(value, 'length') && !(value as {length: any}).length) {
    return true
  }
  return false
}
