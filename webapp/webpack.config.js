const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const cesium = path.resolve(__dirname, 'node_modules/cesium/Build/Cesium');

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      cesium: path.resolve(__dirname, 'node_modules/cesium/Source')
    }
  },
  amd: {
    toUrlUndefined: true
  },
  devServer: {
    static: path.join(__dirname, 'dist'),
    compress: true,
    port: 9000
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: path.join(cesium, 'Workers'), to: 'Workers' },
        { from: path.join(cesium, 'Assets'), to: 'Assets' },
        { from: path.join(cesium, 'Widgets'), to: 'Widgets' },
        { from: path.join(cesium, 'ThirdParty'), to: 'ThirdParty' }
      ]
    }),
    new webpack.DefinePlugin({
      CESIUM_BASE_URL: JSON.stringify('')
    })
  ]
};
