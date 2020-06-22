const webpack = require('webpack');
const __DEV__ = process.env.NODE_ENV === 'development';
module.exports = {
    configureWebpack: {
        resolve: {
            modules: [
                'src/source',
            ]
        },
        plugins: [
            new webpack.DefinePlugin({
                __DEV__,
            })
        ]
    },
}