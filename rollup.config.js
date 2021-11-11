import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'index.js',
  output: {
    file: 'index.cjs',
    format: 'cjs',
    exports: 'default'
  },
  external: ['pako', 'qrcode-svg'],
  plugins: [commonjs()]
};
