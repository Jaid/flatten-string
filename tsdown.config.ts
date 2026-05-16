import {defineConfig} from 'tsdown'

import {createEmitDistributionFilesPlugin, createMinifyJavaScriptPlugin, createMinifyTypeDeclarationsPlugin} from './lib/rolldown.ts'

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
