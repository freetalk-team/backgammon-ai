;

const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'board.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'backgammon.min.js',
    libraryTarget: 'umd',
    library: {
        name: 'Backgammon',
        type: 'umd',
          // add this to export your class to the library
        export: "default"
    },
  },

  mode: 'production',
  optimization: {
    // minimize: false,
    // minimizer: [new TerserPlugin()],
  },
  plugins: [

  ],
};
