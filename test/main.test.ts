import {expect, test} from 'bun:test'

const {default: flattenString} = await import('#src/main.ts')
test('concatenates primitive values without a joiner by default', () => {
  const result = flattenString('foo', 'bar', 123)
  expect(result).toBe('foobar123')
})
test('flattens nested iterables recursively', () => {
  const result = flattenString.list('alpha', ['beta', ['gamma']], new Set(['delta', 'epsilon']))
  expect(result).toBe('alpha, beta, gamma, delta, epsilon')
})
test('skips empty, boolean and non-iterable object values', () => {
  const result = flattenString.spaced('alpha', '', false, true, null, undefined, [], {ignored: true}, 'omega')
  expect(result).toBe('alpha omega')
})
test('supports custom joiners', () => {
  const result = flattenString.with(' → ', 'alpha', ['beta', null], 'gamma')
  expect(result).toBe('alpha → beta → gamma')
})
test('exposes the built-in joiner helpers', () => {
  expect(flattenString.lines('alpha', 'beta', 'gamma')).toBe('alpha\nbeta\ngamma')
  expect(flattenString.paragraphs('alpha', 'beta')).toBe('alpha\n\nbeta')
  expect(flattenString.spaced('alpha', 'beta')).toBe('alpha beta')
  expect(flattenString.colon('alpha', 'beta')).toBe('alpha:beta')
  expect(flattenString.comma('alpha', 'beta')).toBe('alpha,beta')
  expect(flattenString.list('alpha', 'beta')).toBe('alpha, beta')
  expect(flattenString.zero('alpha', 'beta')).toBe('alpha\0beta')
  expect(flattenString.tab('alpha', 'beta')).toBe('alpha\tbeta')
})
