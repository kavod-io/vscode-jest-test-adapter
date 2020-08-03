import path from "path";
import webpack from "webpack";

/**
 * This webpack configuration is used to bundle the javascript extension to optimise the performance and size of 
 * extension.
 * 
 * https://code.visualstudio.com/api/working-with-extensions/bundling-extension
 * https://webpack.js.org/configuration/configuration-languages/
 */
const config: webpack.Configuration = {
  target: 'node',

  entry: './src/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
};

export default config;