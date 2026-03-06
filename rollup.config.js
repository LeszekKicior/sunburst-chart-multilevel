import resolve from '@rollup/plugin-node-resolve';
import commonJs from '@rollup/plugin-commonjs';
import postCss from 'rollup-plugin-postcss';
import babel from '@rollup/plugin-babel';
import terser from "@rollup/plugin-terser";
import dts from 'rollup-plugin-dts';

import pkg from './package.json' with { type: 'json' };
const { name, homepage, version, dependencies, peerDependencies } = pkg;
const packageBaseName = name.includes('/') ? name.split('/').pop() : name;

const umdConf = {
  format: 'umd',
  name: 'Sunburst',
  banner: `// Version ${version} ${name} - ${homepage}`
};

export default [
  {
    input: 'src/index.js',
    output: [
      { // umd
        ...umdConf,
        file: `dist/${packageBaseName}.js`,
        sourcemap: true,
      },
      { // minify
        ...umdConf,
        file: `dist/${packageBaseName}.min.js`,
        plugins: [terser({
          output: { comments: '/Version/' }
        })]
      }
    ],
    plugins: [
      postCss(),
      resolve(),
      commonJs(),
      babel({ exclude: 'node_modules/**' })
    ]
  },
  { // ES module
    input: 'src/index.js',
    output: [
      {
        format: 'es',
        file: `dist/${packageBaseName}.mjs`
      }
    ],
    external: [...Object.keys(dependencies || {}), ...Object.keys(peerDependencies || {})],
    plugins: [
      postCss(),
      babel()
    ]
  },
  { // expose TS declarations
    input: 'src/index.d.ts',
    output: [{
      file: `dist/${packageBaseName}.d.ts`,
      format: 'es'
    }],
    plugins: [dts()]
  }
];
