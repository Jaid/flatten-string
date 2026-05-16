import type {OutputBundle, OutputChunk, Plugin} from 'rolldown'

import {resolve} from 'node:path'

import fs from 'fs-extra'
import * as terser from 'terser'
import * as typescript from 'typescript'

type EntryExport = {
  default: string
  import: string
  types?: string
}

type RootPackageJson = {
  author?: unknown
  bin?: unknown
  bugs?: unknown
  dependencies?: Record<string, string>
  description?: string
  engines?: Record<string, string>
  funding?: unknown
  homepage?: string
  keywords?: Array<string>
  license?: string
  name?: string
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, unknown>
  repository?: unknown
  sideEffects?: Array<string> | boolean
  type?: string
  version?: string
}

type DistributionPackageJson = RootPackageJson & {
  exports: {
    '.': EntryExport
  }
  type: 'commonjs' | 'module'
  types?: string
}

type MinificationResult = {
  code: string
  minifiedSize: number
  originalSize: number
}

type DistributionEntryFiles = {
  declarationEntryFileName?: string
  scriptEntryFileName: string
}

const packageJsonFile = resolve('package.json')
const readmeFile = resolve('readme.md')
const licenseFile = resolve('license.txt')
const triviaTokenKinds = new Set([
  typescript.SyntaxKind.ConflictMarkerTrivia,
  typescript.SyntaxKind.MultiLineCommentTrivia,
  typescript.SyntaxKind.NewLineTrivia,
  typescript.SyntaxKind.ShebangTrivia,
  typescript.SyntaxKind.SingleLineCommentTrivia,
  typescript.SyntaxKind.WhitespaceTrivia,
])
const touchingTokenCache = new Map<string, boolean>
const getMinifiedSize = (content: string) => {
  return Buffer.byteLength(content)
}
const isOutputChunk = (bundleItem: OutputBundle[string]): bundleItem is OutputChunk => {
  return bundleItem.type === 'chunk'
}
const canTokensTouch = (leftTokenText: string, rightTokenText: string) => {
  if (!leftTokenText || !rightTokenText) {
    return true
  }
  const cacheKey = `${leftTokenText}\0${rightTokenText}`
  const cached = touchingTokenCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }
  const scanner = typescript.createScanner(typescript.ScriptTarget.Latest, false, typescript.LanguageVariant.Standard, `${leftTokenText}${rightTokenText}`)
  const firstToken = scanner.scan()
  const firstTokenText = scanner.getTokenText()
  const secondToken = scanner.scan()
  const secondTokenText = scanner.getTokenText()
  const thirdToken = scanner.scan()
  const result = firstToken !== typescript.SyntaxKind.EndOfFileToken
    && firstTokenText === leftTokenText
    && secondToken !== typescript.SyntaxKind.EndOfFileToken
    && secondTokenText === rightTokenText
    && thirdToken === typescript.SyntaxKind.EndOfFileToken
  touchingTokenCache.set(cacheKey, result)
  return result
}
const formatDiagnostics = (fileName: string, diagnostics: ReadonlyArray<typescript.Diagnostic>) => {
  return diagnostics.map(diagnostic => {
    const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    if (diagnostic.start === undefined) {
      return message
    }
    const {line, character} = typescript.getLineAndCharacterOfPosition(diagnostic.file ?? typescript.createSourceFile(fileName, '', typescript.ScriptTarget.Latest), diagnostic.start)
    return `${fileName}:${line + 1}:${character + 1} ${message}`
  }).join('\n')
}
const readTextFileIfExists = async (file: string) => {
  try {
    return await fs.readFile(file, 'utf8')
  } catch (error) {
    const errnoException = error as NodeJS.ErrnoException
    if (errnoException.code === 'ENOENT') {
      return
    }
    throw error
  }
}
const getParseDiagnostics = (sourceFile: typescript.SourceFile) => {
  return (sourceFile as typescript.SourceFile & {parseDiagnostics?: ReadonlyArray<typescript.Diagnostic>}).parseDiagnostics ?? []
}
const getEntryChunkFileName = (bundle: OutputBundle, fileNamePattern: RegExp) => {
  const entryChunk = Object.values(bundle).find(bundleItem => {
    return isOutputChunk(bundleItem) && bundleItem.isEntry && fileNamePattern.test(bundleItem.fileName)
  })
  return entryChunk?.fileName
}

export const minifyJavaScript = async (code: string): Promise<MinificationResult> => {
  const originalSize = getMinifiedSize(code)
  const result = terser.minify_sync(code, {
    compress: {
      passes: 100,
    },
    ecma: 2020,
    format: {
      beautify: false,
      semicolons: false,
    },
    module: true,
    toplevel: true,
  })
  if (!result.code) {
    throw new Error('JavaScript minification failed.')
  }
  return {
    code: result.code,
    minifiedSize: getMinifiedSize(result.code),
    originalSize,
  }
}

export const minifyTypeDeclarations = (code: string): MinificationResult => {
  const originalSize = getMinifiedSize(code)
  const scanner = typescript.createScanner(typescript.ScriptTarget.Latest, false, typescript.LanguageVariant.Standard, code)
  let minifiedCode = ''
  let previousTokenText = ''
  while (true) {
    const token = scanner.scan()
    if (token === typescript.SyntaxKind.EndOfFileToken) {
      break
    }
    if (triviaTokenKinds.has(token)) {
      continue
    }
    const tokenText = scanner.getTokenText()
    if (minifiedCode && !canTokensTouch(previousTokenText, tokenText)) {
      minifiedCode += ' '
    }
    minifiedCode += tokenText
    previousTokenText = tokenText
  }
  const sourceFile = typescript.createSourceFile('main.d.ts', minifiedCode, typescript.ScriptTarget.Latest, false, typescript.ScriptKind.TS)
  const parseDiagnostics = getParseDiagnostics(sourceFile)
  if (parseDiagnostics.length) {
    throw new Error(`Type declaration minification failed validation.\n${formatDiagnostics('main.d.ts', parseDiagnostics)}`)
  }
  return {
    code: minifiedCode,
    minifiedSize: getMinifiedSize(minifiedCode),
    originalSize,
  }
}

export const toDistributionPackageJson = (rootPackageJson: RootPackageJson, {declarationEntryFileName, scriptEntryFileName}: DistributionEntryFiles): DistributionPackageJson => {
  if (!rootPackageJson.name) {
    throw new Error('The root package.json is missing "name".')
  }
  if (!rootPackageJson.version) {
    throw new Error('The root package.json is missing "version".')
  }
  const entryExport: EntryExport = {
    default: `./${scriptEntryFileName}`,
    import: `./${scriptEntryFileName}`,
    ...declarationEntryFileName ? {
      types: `./${declarationEntryFileName}`,
    } : {},
  }
  return {
    ...rootPackageJson.author ? {author: rootPackageJson.author} : {},
    ...rootPackageJson.bin ? {bin: rootPackageJson.bin} : {},
    ...rootPackageJson.bugs ? {bugs: rootPackageJson.bugs} : {},
    ...rootPackageJson.dependencies ? {dependencies: rootPackageJson.dependencies} : {},
    ...rootPackageJson.description ? {description: rootPackageJson.description} : {},
    ...rootPackageJson.engines ? {engines: rootPackageJson.engines} : {},
    ...rootPackageJson.funding ? {funding: rootPackageJson.funding} : {},
    ...rootPackageJson.homepage ? {homepage: rootPackageJson.homepage} : {},
    ...rootPackageJson.keywords ? {keywords: rootPackageJson.keywords} : {},
    ...rootPackageJson.license ? {license: rootPackageJson.license} : {},
    name: rootPackageJson.name,
    ...rootPackageJson.optionalDependencies ? {optionalDependencies: rootPackageJson.optionalDependencies} : {},
    ...rootPackageJson.peerDependencies ? {peerDependencies: rootPackageJson.peerDependencies} : {},
    ...rootPackageJson.peerDependenciesMeta ? {peerDependenciesMeta: rootPackageJson.peerDependenciesMeta} : {},
    ...rootPackageJson.repository ? {repository: rootPackageJson.repository} : {},
    ...rootPackageJson.sideEffects !== undefined ? {sideEffects: rootPackageJson.sideEffects} : {},
    version: rootPackageJson.version,
    type: rootPackageJson.type === 'commonjs' ? 'commonjs' : 'module',
    exports: {
      '.': entryExport,
    },
    ...entryExport.types ? {types: entryExport.types} : {},
  }
}

export const createMinifyJavaScriptPlugin = (): Plugin => {
  return {
    name: 'minify-javascript',
    async generateBundle(_outputOptions, bundle) {
      for (const bundleItem of Object.values(bundle)) {
        if (!isOutputChunk(bundleItem) || !/\.[cm]?js$/u.test(bundleItem.fileName)) {
          continue
        }
        const minificationResult = await minifyJavaScript(bundleItem.code)
        bundleItem.code = minificationResult.code
      }
    },
  }
}

export const createMinifyTypeDeclarationsPlugin = (): Plugin => {
  return {
    name: 'minify-type-declarations',
    generateBundle(_outputOptions, bundle) {
      for (const bundleItem of Object.values(bundle)) {
        if (!isOutputChunk(bundleItem) || !/\.d\.[cm]?ts$/u.test(bundleItem.fileName)) {
          continue
        }
        const minificationResult = minifyTypeDeclarations(bundleItem.code)
        bundleItem.code = minificationResult.code
      }
    },
  }
}

export const createEmitDistributionFilesPlugin = (): Plugin => {
  return {
    name: 'emit-distribution-files',
    async buildStart() {
      for (const file of [packageJsonFile, readmeFile, licenseFile]) {
        try {
          await fs.access(file)
          this.addWatchFile(file)
        } catch (error) {
          const errnoException = error as NodeJS.ErrnoException
          if (errnoException.code !== 'ENOENT') {
            throw error
          }
        }
      }
    },
    async generateBundle(_outputOptions, bundle) {
      const packageJsonContent = await fs.readFile(packageJsonFile, 'utf8')
      const rootPackageJson = JSON.parse(packageJsonContent) as RootPackageJson
      const scriptEntryFileName = getEntryChunkFileName(bundle, /\.[cm]?js$/u)
      if (!scriptEntryFileName) {
        throw new Error('No JavaScript entry chunk was emitted.')
      }
      const declarationEntryFileName = getEntryChunkFileName(bundle, /\.d\.[cm]?ts$/u)
      const distributionPackageJson = toDistributionPackageJson(rootPackageJson, {
        declarationEntryFileName,
        scriptEntryFileName,
      })
      this.emitFile({
        type: 'asset',
        fileName: 'package.json',
        originalFileName: packageJsonFile,
        source: JSON.stringify(distributionPackageJson),
      })
      const readmeContent = await readTextFileIfExists(readmeFile)
      if (readmeContent !== undefined) {
        this.emitFile({
          type: 'asset',
          fileName: 'README.md',
          originalFileName: readmeFile,
          source: readmeContent,
        })
      }
      const licenseContent = await readTextFileIfExists(licenseFile)
      if (licenseContent !== undefined) {
        this.emitFile({
          type: 'asset',
          fileName: 'LICENSE',
          originalFileName: licenseFile,
          source: licenseContent,
        })
      }
    },
  }
}
