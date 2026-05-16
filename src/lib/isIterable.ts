type PossibleIterable = {
  [Symbol.iterator]?: unknown
}

export default (value: unknown): value is Iterable<unknown> => {
  if (typeof value !== 'object') {
    return false
  }
  if (typeof (value as PossibleIterable)[Symbol.iterator] !== 'function') {
    return false
  }
  return true
}
