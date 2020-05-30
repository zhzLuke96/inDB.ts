const {
    resolve
} = require('path');
const devMode = process.env.NODE_ENV !== 'production'

module.exports = {
    devtool: devMode ? "inline-source-map" : false,
    entry: {
        "index": './src/index.ts'
    },
    output: {
        library: "inDB",
        libraryTarget: "umd",
        filename: devMode ? '[name].js' : '[name].min.js',
        path: resolve(__dirname, 'dist')
    },
    module: {
        rules: [{
            test: /\.ts$/,
            use: "ts-loader",
            exclude: /(node_modules|bower_components)/,
        }]
    },
    resolve: {
        extensions: [
            '.ts', ".js", ".jsx", "tsx"
        ]
    }
};