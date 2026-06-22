const path = require('path')
const jestConfigFactory = require('@enhanced-dom/jest').jestConfigFactory
const baseConfig = jestConfigFactory({ ts: true, processorConfigPath: path.join(__dirname, 'tsconfig.json') })
module.exports = {
  ...baseConfig,
  transformIgnorePatterns: ['node_modules/(?!@enhanced-dom/|lodash-es)'],
}
