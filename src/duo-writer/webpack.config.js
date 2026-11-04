// Duo Writer build. Based on nienow/sn-extension-template (MIT), trimmed:
// no sass, no zip plugin (build.sh at the repo root makes the versioned zip),
// and the output goes straight into the published folder editors/duo-writer/.
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const PACKAGE = require('./package.json');
const version = PACKAGE.version;
const OUT = path.resolve(__dirname, '../../editors/duo-writer');

module.exports = (env, argv) => ({
  mode: 'production',
  entry: {
    main: 'index.tsx',
    demo: 'demo/demo.tsx'
  },
  output: {
    path: OUT,
    filename: '[name].[contenthash].js',
    publicPath: '',
    clean: {keep: /\.zip$/} // older release zips stay published (see build.sh)
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {loader: 'babel-loader'}
      },
      {
        test: /\.css$/i,
        // url: false keeps font paths literal, so fonts/... resolves relative
        // to index.html both on GitHub Pages and in the desktop app's local copy.
        use: ['style-loader', {loader: 'css-loader', options: {url: false}}]
      }
    ]
  },
  resolve: {
    modules: ['node_modules', 'src'],
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime'
    }
  },
  devServer: {
    static: {directory: OUT},
    open: ['/demo.html'],
    headers: {'Access-Control-Allow-Origin': '*'}
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: './src/index.html',
      chunks: ['main']
    }),
    new HtmlWebpackPlugin({
      filename: 'demo.html',
      template: './src/index.html',
      chunks: ['demo']
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'public',
          // Version substitution for the JSON descriptors only. Binary files (fonts)
          // must pass through untouched: a text round-trip corrupts them.
          transform(content, absoluteFrom) {
            if (!absoluteFrom.endsWith('.json')) return content;
            return content.toString().split('$VERSION$').join(version);
          }
        },
        {
          // The Duo S font files live once, in the theme folder.
          from: path.resolve(__dirname, '../../themes/duo'),
          to: 'fonts',
          filter: (p) => p.endsWith('.woff2') || p.endsWith('LICENSE.md')
        }
      ]
    })
  ]
});
