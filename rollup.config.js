import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript'

import pkg from './package.json'

export default {
  input: 'src/index.js',
  output: [
    {
      format: 'esm',
      file: pkg.module,
      exports: 'default',
    },
    {
      format: 'cjs',
      file: pkg.main,
      exports: 'default',
    },
  ],
  external: ['ethereumjs-util', 'ethers', 'fs', 'ow'],
  plugins: [
    typescript({ module: 'CommonJS' }),
    commonjs({ extensions: ['.js', '.ts'] }),
  ],
}
