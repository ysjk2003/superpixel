const path = require("path")

const HtmlWebpackPlugin = require("html-webpack-plugin")

const mode = process.env.NODE_ENV || "development"

module.exports = {
  mode: mode,
  entry: {
    main: "./src/main.ts",
  },
  output: {
    filename: "[name].js",
    path: path.resolve("./dist"),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
      {
        test: /\.(png|jpg|svg|gif)$/,
        use: {
          loader: "url-loader",
          options: {
            publicPath: "./dist/",
            name: "[name].[ext]?[hash]",
            limit: 5000,
          },
        },
      },
    ],
  },
  devServer: {
    port: 3001,
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
    hot: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      minify:
        mode === "production"
          ? {
              collapseWhitespace: true,
              removeComments: true,
            }
          : false,
    }),
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
}
