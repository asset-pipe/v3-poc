// rollup.config.js
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
    input: 'assets/scripts.js',
    preserveModules: true,
    output: {
        dir: 'assets',
        format: 'esm',
        sourcemap: 'inline',
    },
    plugins: [
        commonjs({
            include: /node_modules/,
        }),
        nodeResolve(),
    ],
};
