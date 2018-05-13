import babel from 'rollup-plugin-babel'
import uglify from 'rollup-plugin-uglify'

export default {
    input: 'src/twkb.js',
    output: {
      file: 'dist/twkb.min.js',
      name: 'twkb',
      format: 'umd'
    },
    plugins: [
      babel(),
      uglify()
    ]
  }