import type {Plugin} from 'rolldown'

import * as typescript from 'typescript'

import {getOutputChunksMatchingFileNamePattern} from './rolldown.ts'

type MinificationResult = {
  code: string
  minifiedSize: number
  originalSize: number
}

const triviaTokenKinds = new Set([
  typescript.SyntaxKind.ConflictMarkerTrivia,
  typescript.SyntaxKind.MultiLineCommentTrivia,
  typescript.SyntaxKind.NewLineTrivia,
  typescript.SyntaxKind.ShebangTrivia,
  typescript.SyntaxKind.SingleLineCommentTrivia,
  typescript.SyntaxKind.WhitespaceTrivia,
])
const touchingTokenCache = new Map<string, boolean>
const getByteLength = (content: string) => {
  return Buffer.byteLength(content)
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
const getParseDiagnostics = (sourceFile: typescript.SourceFile) => {
  return (sourceFile as typescript.SourceFile & {parseDiagnostics?: ReadonlyArray<typescript.Diagnostic>}).parseDiagnostics ?? []
}

export const minifyTypeDeclarations = (code: string): MinificationResult => {
  const originalSize = getByteLength(code)
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
    minifiedSize: getByteLength(minifiedCode),
    originalSize,
  }
}

export const createMinifyTypeDeclarationsPlugin = (): Plugin => {
  return {
    name: 'minify-type-declarations',
    generateBundle(_outputOptions, bundle) {
      for (const bundleItem of getOutputChunksMatchingFileNamePattern(bundle, /\.d\.[cm]?ts$/u)) {
        const minificationResult = minifyTypeDeclarations(bundleItem.code)
        bundleItem.code = minificationResult.code
      }
    },
  }
}
