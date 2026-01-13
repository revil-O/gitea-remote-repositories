const path = require('path');

module.exports = {
  target: 'node',
  mode: 'production',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'release'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  devtool: 'hidden-source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    fallback: {
      'path': require.resolve('path-browserify'),
      'fs': false,
      'os': false,
      'util': false
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.json')
          }
        }
      }
    ]
  }
};
