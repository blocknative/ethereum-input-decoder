import commonjs from '@rollup/plugin-commonjs'

import pkg from './package.json'

export default {
  input: 'src/index.js',
  output: [
    {
      format: 'esm',
      file: pkg.module,
    },
    {
      format: 'cjs',
      file: pkg.main,
    },
  ],
  external: ['ethereumjs-util', 'ethers', 'fs', 'ow'],
  plugins: [commonjs()],
}
