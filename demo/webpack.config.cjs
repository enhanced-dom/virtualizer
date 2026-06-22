const path = require('path')
const babelConfigFactory = require('@enhanced-dom/babel').configFactory
const webpackConfigFactory = require('@enhanced-dom/webpack')

fs = require('fs')

module.exports = (env = {}, argv = {}) => {
  const isProduction = argv.mode === 'production'
  const publicPath = '/'
  const babelConfig = babelConfigFactory()

  return {
    mode: isProduction ? 'production' : 'development',
    entry: { bundle: [`./${path.relative(process.cwd(), path.resolve(__dirname, './index.tsx'))}`] },
    output: {
      filename: 'bundle-[contenthash].js',
      publicPath,
      path: path.resolve(__dirname, '../docs'),
      clean: isProduction,
    },
    devtool: isProduction ? false : 'inline-source-map',
    resolve: {
      modules: ['./node_modules', path.resolve('./node_modules')],
      extensions: ['.tsx', '.ts', '.json', '.js', '.jsx'],
    },
    optimization: {
      concatenateModules: true,
      minimize: isProduction,
      emitOnErrors: !isProduction,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: webpackConfigFactory.loaders.babelConfigFactory({ babel: babelConfig, cache: false }),
        },
        {
          test: /\.pcss$/,
          use: webpackConfigFactory.loaders.styleConfigFactory({
            sourceMap: !isProduction,
            parser: 'postcss',
            typedStyles: true,
            modules: true,
          }),
        },
        {
          test: /\.css$/,
          use: webpackConfigFactory.loaders.styleConfigFactory({
            extract: isProduction,
            sourceMap: !isProduction,
            parser: 'postcss',
            typedStyles: false,
          }),
        },
        {
          test: /\.jsx?$/,
          include: /@enhanced-dom/,
          use: webpackConfigFactory.loaders.babelConfigFactory({ babel: babelConfig, cache: true }),
        },
      ].concat(isProduction ? [] : [{ test: /\.jsx?$/, loader: 'source-map-loader', enforce: 'pre', include: /@enhanced-dom/ }]),
    },
    plugins: [
      ...webpackConfigFactory.plugins.htmlConfigFactory({
        embed: isProduction,
        html: {
          minify: isProduction,
          title: 'Scrollbar demo',
        },
      }),
      ...webpackConfigFactory.plugins.cssConfigFactory(),
    ],
    devServer: { historyApiFallback: true, port: 3000 },
  }
}
