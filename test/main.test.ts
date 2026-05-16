import {expect, test} from 'bun:test'

const {default: flattenString} = await import('#src/main.ts')

test('should run', () => {
  const result = flattenString()
  expect(result).toBe('flatten-string') // TODO Test actual functionality
})
