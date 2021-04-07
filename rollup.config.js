import commonjs from '@rollup/plugin-commonjs'

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
  plugins: [commonjs()],
}
