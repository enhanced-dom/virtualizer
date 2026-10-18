import path from 'path'
import { fileURLToPath } from 'url'
import { configFactory as babelConfigFactory } from '@enhanced-dom/babel'
import webpackConfigFactory from '@enhanced-dom/webpack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default (env = {}, argv = {}) => {
  const isProduction = argv.mode === 'production'
  const isAnalyzing = !!env.analyze
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
      concatenateModules: !isAnalyzing,
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
        embed: isProduction && !isAnalyzing,
        compress: isProduction && !isAnalyzing,
        html: {
          minify: isProduction,
          title: 'Virtualizer demo',
        },
      }),
      ...webpackConfigFactory.plugins.cssConfigFactory(),
      ...(isAnalyzing ? webpackConfigFactory.plugins.bundleAnalyzerConfigFactory() : []),
    ],
    devServer: { historyApiFallback: true, port: 3000 },
  }
}
