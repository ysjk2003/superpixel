const path = require("path")

module.exports = {
  mode: "development",
  entry: {
    main: "./js/main.js",
  },
  output: {
    filename: "[name].js",
    path: path.resolve("./dist"),
  },
  module: {
    rules: [
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
    static: {
      directory: __dirname,
    },
  },
}
