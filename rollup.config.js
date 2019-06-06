import babel from 'rollup-plugin-babel'
import { terser } from 'rollup-plugin-terser'

export default {
    input: 'src/twkb.js',
    output: {
      file: 'dist/twkb.min.js',
      name: 'twkb',
      format: 'umd'
    },
    plugins: [
      babel(),
      terser()
    ]
  }
