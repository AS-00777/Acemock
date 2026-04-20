const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (_env, argv) => {
  const isProd = argv.mode === "production";

  return {
    target: "web",
    entry: path.resolve(__dirname, "index.tsx"),
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: isProd ? "assets/[name].[contenthash].js" : "assets/[name].js",
      chunkFilename: isProd ? "assets/[name].[contenthash].js" : "assets/[name].js",
      publicPath: "/",
      clean: true,
    },
    devtool: isProd ? "source-map" : "eval-cheap-module-source-map",
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
              presets: [
                ["@babel/preset-env", { targets: "defaults" }],
                ["@babel/preset-react", { runtime: "automatic" }],
                ["@babel/preset-typescript", { allExtensions: true, isTSX: true }],
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            "style-loader",
            { loader: "css-loader", options: { importLoaders: 1 } },
            "postcss-loader",
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "index.html"),
      }),
    ],
    devServer: {
      host: "0.0.0.0",
      port: 3000,
      historyApiFallback: true,
      hot: true,
      client: {
        overlay: true,
      },
    },
    performance: { hints: false },
    stats: "errors-warnings",
  };
};

