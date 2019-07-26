#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const tempDir = require('temp-dir');
const mkdir = require('make-dir');
const { writeFileSync, createReadStream } = require('fs');
const { join, dirname } = require('path');
const { execSync } = require('child_process');
const FormData = require('form-data');
const rollup = require('rollup');
const commonjs = require('rollup-plugin-commonjs');
const replace = require('rollup-plugin-replace');
const resolve = require('rollup-plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');
const semver = require('semver');
const ora = require('ora');

function upload({ server, file } = {}) {
    const form = new FormData();
    form.append('file', createReadStream(file));

    return new Promise((resolve, reject) => {
        form.submit(`${server}/global/publish`, (err, res) => {
            if (err) return reject(err);

            res.once('data', chunk => {
                resolve(JSON.parse(chunk.toString()));
            });
        });
    });
}

async function main(pkg, org, server = 'http://localhost:4001') {
    console.log('');
    console.log('✨', 'Asset Pipe Global Publish', '✨');
    console.log('');

    const inputValidationSpinner = ora('Validating input').start();
    const [name, version] = pkg.trim().split('@');
    let path = '';
    let file = '';
    let result = {};

    if (!pkg.includes('@')) {
        inputValidationSpinner.fail(
            `Invalid package name and/or version given`
        );
        process.exit();
    }

    if (!semver.valid(version)) {
        inputValidationSpinner.fail(
            'Invalid semver range detected for package'
        );
        process.exit();
    }

    if (!org) {
        inputValidationSpinner.fail(
            `Value for 'org' is required but was not provided`
        );
        process.exit();
    }

    inputValidationSpinner.succeed();

    const tempDirSpinner = ora('Creating temp directory').start();
    try {
        path = join(tempDir, `global-publish-${name}-${version}`);
        mkdir(path);
    } catch (err) {
        tempDirSpinner.fail('Unable to create temp dir');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    tempDirSpinner.succeed();

    const pkgSpinner = ora(
        'Creating package json file in temp directory'
    ).start();
    try {
        writeFileSync(
            join(path, 'package.json'),
            JSON.stringify({
                name: '',
                dependencies: {
                    [name]: version,
                },
            })
        );
    } catch (err) {
        pkgSpinner.fail('Unable to create package json in temp directory');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    pkgSpinner.succeed();

    const npmInstallSpinner = ora(
        'Running npm install in temp directory'
    ).start();
    try {
        execSync('npm i --loglevel=silent', { cwd: path });
    } catch (err) {
        npmInstallSpinner.fail(
            'Unable to complete npm install operation, is the supplied module version correct?'
        );

        console.log('==========');
        console.error(err.message);
        console.log('==========');

        process.exit();
    }
    npmInstallSpinner.succeed();

    const bundleSpinner = ora('Creating bundle in temp directory').start();

    try {
        const resolvedPath = require.resolve(name, { paths: [path] });
        const installedDepBasePath = dirname(resolvedPath);
        const installedDepPackagePath = join(
            installedDepBasePath,
            'package.json'
        );
        const installedDepPkgJson = require(installedDepPackagePath);

        const options = {
            onwarn: (warning, warn) => {
                // Supress logging
            },
            plugins: [
                resolve(),
                commonjs(),
                replace({
                    'process.env.NODE_ENV': JSON.stringify('production'),
                }),
                terser(),
            ],
        };

        if (installedDepPkgJson.module) {
            // use installedDepPkgJson.module
            bundleSpinner.text = `${bundleSpinner.text} (module)`;
            options.input = join(
                installedDepBasePath,
                installedDepPkgJson.module
            );
        } else {
            // use installedDepPkgJson.main
            bundleSpinner.text = `${bundleSpinner.text} (common js)`;
            options.input = join(
                installedDepBasePath,
                installedDepPkgJson.main
            );
        }

        file = join(
            path,
            `${org}:${installedDepPkgJson.name}:${
                installedDepPkgJson.version
            }.js`
        );

        const bundled = await rollup.rollup(options);
        await bundled.write({ format: 'esm', file });
    } catch (err) {
        bundleSpinner.fail('Unable to complete bundle operation');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    bundleSpinner.succeed();

    const uploadSpinner = ora('Uploading bundle to asset server').start();
    try {
        result = await upload({ server, file });
        if (result.error) {
            uploadSpinner.text = `${
                uploadSpinner.text
            } (version already exists)`;
        }
    } catch (err) {
        uploadSpinner.fail('Unable to complete upload to asset server');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    uploadSpinner.succeed();

    console.log('');
    console.log('✨', result.url, '✨');
    console.log('');
}

module.exports = main;

if (!module.parent) {
    try {
        // process args
        const [pkg] = yargs.argv._;
        const org = yargs.argv.org;
        const server = yargs.argv.server;

        main(pkg, org, server);
    } catch (err) {
        console.error(err);
    }
}
