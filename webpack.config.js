const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

const entries = {
  checkEligibility: "./src/lambdas/check-eligibility.ts",
  getOTP: "./src/lambdas/get-otp.ts",
  requestOTP: "./src/lambdas/request-otp.ts",
  smsSender: "./src/lambdas/sms-sender.ts",
  twilioWebhook: "./src/lambdas/twilio-webhook.ts",
  validateQR: "./src/lambdas/validate-qr.ts",
  verifyOTP: "./src/lambdas/verify-otp.ts",
};

module.exports = {
  entry: entries,
  target: "node",
  mode: "production",
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: true,
          mangle: true,
        },
      }),
    ],
  },
  output: {
    filename: "[name]/app.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs2",
    library: {
      type: "commonjs2",
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  externals: {
    // Add any AWS SDK modules as externals since they are available in the Lambda runtime
    "aws-sdk": "aws-sdk",
  },
};
