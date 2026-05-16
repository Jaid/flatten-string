import {expect, test} from 'bun:test'

import {toDistributionPackageJson} from '#root/lib/createEmitDistributionFilesPlugin.ts'
import {minifyTypeDeclarations} from '#root/lib/createMinifyTypeDeclarationsPlugin.ts'

test('minifies type declarations without changing literal contents', () => {
  const declarationFile = `
    //#region example
    export type Example = {
      message: 'a : b'
    }
    //#endregion
  `
  const minificationResult = minifyTypeDeclarations(declarationFile)
  expect(minificationResult.minifiedSize).toBeLessThan(minificationResult.originalSize)
  expect(minificationResult.code).toBe("export type Example={message:'a : b'}")
})
test('creates a distribution package.json with relative dist-local entrypoints', () => {
  const rootPackageJson = {
    description: 'joins nested string-ish input',
    funding: 'https://github.com/sponsors/Jaid',
    license: 'MIT',
    name: 'flatten-string',
    repository: {
      type: 'git',
      url: 'git+https://github.com/Jaid/flatten-string.git',
    },
    scripts: {
      build: 'tsdown',
    },
    type: 'module',
    version: '0.1.0',
  }
  const distributionPackageJson = toDistributionPackageJson(rootPackageJson, {
    declarationEntryFileName: 'main.d.ts',
    scriptEntryFileName: 'main.js',
  })
  expect(distributionPackageJson).toEqual({
    description: 'joins nested string-ish input',
    funding: 'https://github.com/sponsors/Jaid',
    license: 'MIT',
    name: 'flatten-string',
    repository: {
      type: 'git',
      url: 'git+https://github.com/Jaid/flatten-string.git',
    },
    version: '0.1.0',
    type: 'module',
    exports: {
      '.': {
        default: './main.js',
        import: './main.js',
        types: './main.d.ts',
      },
    },
    types: './main.d.ts',
  })
})
