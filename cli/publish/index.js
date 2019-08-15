'use strict';

const FormData = require('form-data');
const fs = require('fs');
const mkdir = require('make-dir');
const tempDir = require('temp-dir');
const ora = require('ora');
const { join } = require('path');
const rollup = require('rollup');
const commonjs = require('rollup-plugin-commonjs');
const replace = require('rollup-plugin-replace');
const resolve = require('rollup-plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');
const esmImportToUrl = require('rollup-plugin-esm-import-to-url');
const fetch = require('node-fetch');
const { resolvePath } = require('../utils');

function upload({ server, file, org, name, version } = {}) {
    const form = new FormData();
    form.append('main:js', fs.createReadStream(file));
    form.append('sourcemap:js', fs.createReadStream(`${file}.map`));
    form.append('org', org);
    form.append('name', name);
    form.append('version', version);

    return new Promise((resolve, reject) => {
        form.submit(`${server}/publish`, (err, res) => {
            if (err) return reject(err);

            res.once('data', chunk => {
                const str = chunk.toString();
                if (str) {
                    resolve(JSON.parse(str));
                } else {
                    resolve();
                }
            });
        });
    });
}

async function main(metaPath = './assets.json') {
    let path = '';
    let pathToMeta = '';
    let meta = {};
    let jsAssetPaths = '';
    let organisation = '';
    let name = '';
    let version = '';
    let server = '';
    let inputs = {};
    let file = '';
    let importMap = { imports: {} };

    const loadAssetsSpinner = ora('Reading assets.json metafile').start();
    try {
        // load assets.json
        pathToMeta = resolvePath(metaPath).pathname;
        meta = JSON.parse(fs.readFileSync(pathToMeta));
        organisation = meta.organisation;
        name = meta.name;
        version = meta.version;
        server = meta.server;
        inputs = meta.inputs;
        jsAssetPaths = resolvePath(inputs.js);
        // const cssAssetPaths = resolvePath(inputs.css);
    } catch (err) {
        loadAssetsSpinner.fail('Unable to read assets.json metafile');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    loadAssetsSpinner.succeed();

    const tempDirSpinner = ora('Creating temp directory').start();
    try {
        path = join(tempDir, `publish-${name}-${version}`);
        mkdir.sync(path);
    } catch (err) {
        tempDirSpinner.fail('Unable to create temp dir');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    tempDirSpinner.succeed();

    const loadImportMapSpinner = ora(
        'Loading import map file from server'
    ).start();
    try {
        const result = await fetch(`${server}/${organisation}/map/js`);
        importMap = await result.json();
    } catch (err) {
        loadImportMapSpinner.fail('Unable to load import map file from server');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    loadImportMapSpinner.succeed();

    const bundleSpinner = ora('Creating bundle file').start();
    try {
        const options = {
            onwarn: (warning, warn) => {
                // Supress logging
            },
            plugins: [
                esmImportToUrl(importMap),
                resolve(),
                commonjs({
                    // include: /node_modules/,
                }),
                // fetch and read import-map file from server
                replace({
                    'process.env.NODE_ENV': JSON.stringify('production'),
                }),
                terser(),
            ],
            input: jsAssetPaths.pathname,
        };

        file = join(path, `index.js`);

        const bundled = await rollup.rollup(options);
        await bundled.write({
            format: 'esm',
            file,
            sourcemap: true,
        });
    } catch (err) {
        bundleSpinner.fail('Unable to create bundle file');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    bundleSpinner.succeed();

    const uploadSpinner = ora('Uploading bundle file to server').start();
    let uploadResult = {};
    try {
        uploadResult = await upload({
            server,
            org: organisation,
            name,
            version,
            file,
        });
    } catch (err) {
        uploadSpinner.fail('Unable to upload bundle file');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    uploadSpinner.succeed();

    console.log('');
    console.log('✨', uploadResult.url, '✨');
    console.log('');
}

module.exports = main;
