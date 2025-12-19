import { join } from 'node:path'

import webpack from 'webpack'
import 'webpack-dev-server'

const dirname = import.meta.dirname || new URL('.', import.meta.url).pathname

/** @type {import('webpack').Configuration[]} */
const config = [
  {
    mode: 'development',
    devtool: 'source-map',
    optimization: {
      minimize: false,
      moduleIds: 'named',
      chunkIds: 'named'
    },
    entry: [join(dirname, 'index.ts')],
    output: {
      path: join(dirname, 'build'),
      filename: 'index.js',
      publicPath: './'
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true
              }
            }
          ]
        }
      ]
    },
    externals: {
      '@thaunknown/yencode/build/Release/yencode.node': 'require("@thaunknown/yencode/build/Release/yencode.node")',
      '@thaunknown/yencode': 'require("@thaunknown/yencode")'
    },
    resolve: {
      aliasFields: [],
      extensions: ['.ts', '.tsx', '.js', '.json'],
      extensionAlias: {
        '.ts': ['.ts', '.js'],
        '.js': ['.ts', '.js']
      },
      mainFields: ['module', 'main', 'node']
    },
    target: 'node',
    devServer: {
      devMiddleware: {
        writeToDisk: true
      },
      hot: false,
      client: false
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1
      })
    ]
  }
]

export default config
