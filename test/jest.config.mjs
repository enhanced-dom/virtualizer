import path from 'path'
import { fileURLToPath } from 'url'
import { jestConfigFactory } from '@enhanced-dom/jest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const baseConfig = jestConfigFactory({ ts: true, processorConfigPath: path.join(__dirname, 'tsconfig.json') })

export default {
  ...baseConfig,
  transformIgnorePatterns: ['node_modules/(?!@enhanced-dom/|lodash-es)'],
}
