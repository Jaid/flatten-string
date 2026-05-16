import {defineConfig} from 'tsdown'

import {createEmitDistributionFilesPlugin} from './lib/createEmitDistributionFilesPlugin.ts'
import {createMinifyJavaScriptPlugin} from './lib/createMinifyJavaScriptPlugin.ts'
import {createMinifyTypeDeclarationsPlugin} from './lib/createMinifyTypeDeclarationsPlugin.ts'

export default defineConfig({
  clean: true,
  dts: true,
  entry: 'src/main.ts',
  fixedExtension: false,
  format: 'esm',
  outDir: 'dist',
  plugins: [
    createMinifyJavaScriptPlugin(),
    createMinifyTypeDeclarationsPlugin(),
    createEmitDistributionFilesPlugin(),
  ],
})
