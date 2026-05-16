import type {OutputBundle, Plugin} from 'rolldown'

import {resolve} from 'node:path'

import fs from 'fs-extra'

import {getOutputChunksMatchingFileNamePattern} from './rolldown.ts'

export type EntryExport = {
  default: string
  import: string
  types?: string
}

export type RootPackageJson = {
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

type DistributionEntryFiles = {
  declarationEntryFileName?: string
  scriptEntryFileName: string
}

const packageJsonFile = resolve('package.json')
const readmeFile = resolve('readme.md')
const licenseFile = resolve('license.txt')
const watchedFiles = [packageJsonFile, readmeFile, licenseFile]
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
const getEntryChunkFileName = (bundle: OutputBundle, fileNamePattern: RegExp) => {
  const entryChunk = getOutputChunksMatchingFileNamePattern(bundle, fileNamePattern).find(bundleItem => {
    return bundleItem.isEntry
  })
  return entryChunk?.fileName
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

export const createEmitDistributionFilesPlugin = (): Plugin => {
  return {
    name: 'emit-distribution-files',
    async buildStart() {
      for (const file of watchedFiles) {
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
