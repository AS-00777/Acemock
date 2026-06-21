const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const dotenv = require("dotenv");

dotenv.config();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return acc;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      acc[key] = value;
      return acc;
    }, {});
}

module.exports = (_env, argv) => {
  const isProd = argv.mode === "production";
  const localEnv = loadEnvFile(path.resolve(__dirname, ".env.local"));

  const env = {
    ...localEnv,
    ...process.env,
  };

  return {
    target: "web",

    experiments: {
      asyncWebAssembly: true,
    },

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
        {
          test: /\.lottie$/,
          type: "asset/resource",
        },
      ],
    },

    plugins: [
      new webpack.DefinePlugin({
        "import.meta.env": JSON.stringify({
          DEV: !isProd,
          VITE_API_BASE_URL: env.VITE_API_BASE_URL,
          VITE_CLERK_PUBLISHABLE_KEY: env.VITE_CLERK_PUBLISHABLE_KEY,
        }),
      }),

      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "index.html"),
      }),

      new webpack.DefinePlugin({
        "process.env.REACT_APP_CLERK_PUBLISHABLE_KEY": JSON.stringify(
          process.env.REACT_APP_CLERK_PUBLISHABLE_KEY
        ),
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
