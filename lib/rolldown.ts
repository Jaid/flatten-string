import type {OutputBundle, OutputChunk} from 'rolldown'

export const getOutputChunksMatchingFileNamePattern = (bundle: OutputBundle, fileNamePattern: RegExp): Array<OutputChunk> => {
  return Object.values(bundle).filter((bundleItem): bundleItem is OutputChunk => {
    return bundleItem.type === 'chunk' && fileNamePattern.test(bundleItem.fileName)
  })
}
