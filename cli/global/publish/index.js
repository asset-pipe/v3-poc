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
const esmImportToUrl = require('rollup-plugin-esm-import-to-url');
const semver = require('semver');
const ora = require('ora');
const readPkgUp = require('read-pkg-up');
const pkgDir = require('pkg-dir');

const BUCKET = 'asset-pipe-v3';

function upload({ server, file, org, pkg, version, force = false } = {}) {
    const form = new FormData();
    form.append('src', createReadStream(file));
    form.append('map', createReadStream(`${file}.map`));
    form.append('org', org);
    form.append('pkg', pkg);
    form.append('version', version);
    form.append('force', force ? 'true' : 'false');

    return new Promise((resolve, reject) => {
        form.submit(`${server}/global/publish`, (err, res) => {
            if (err) return reject(err);

            res.once('data', chunk => {
                resolve(JSON.parse(chunk.toString()));
            });
        });
    });
}

async function main(
    pkg,
    org,
    server = 'http://localhost:4001',
    globals = [],
    force
) {
    console.log('');
    console.log('✨', 'Asset Pipe Global Publish', '✨');
    console.log('');

    const inputValidationSpinner = ora('Validating input').start();
    const [name, version] = pkg.trim().split('@');
    let path = '';
    let file = '';
    let modulePkgName = '';
    let modulePkgVersion = '';
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
        mkdir.sync(path);
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

    let installedDepBasePath = '';
    let installedDepPkgJson = {};

    const loadingPackageMetaSpinner = ora(
        `Loading meta information for ${pkg} package`
    ).start();
    try {
        const resolvedPath = require.resolve(name, { paths: [path] });
        installedDepBasePath = pkgDir.sync(dirname(resolvedPath));
        installedDepPkgJson = readPkgUp.sync({
            cwd: installedDepBasePath,
        }).package;
    } catch (err) {
        loadingPackageMetaSpinner.fail(
            'Unable to load package meta information'
        );

        console.log('==========');
        console.error(err.message);
        console.log('==========');

        process.exit();
    }
    loadingPackageMetaSpinner.succeed();

    const checkPeerDependenciesSpinner = ora(
        `Checking for peer dependencies`
    ).start();
    try {
        if (installedDepPkgJson.peerDependencies) {
            // check that a global flag has been supplied for each
            for (const dep of Object.keys(
                installedDepPkgJson.peerDependencies
            )) {
                const globalPkgNames = globals.map(global => {
                    const [moduleName] = global.split('@');
                    return moduleName;
                });
                if (!globalPkgNames.includes(dep)) {
                    checkPeerDependenciesSpinner.fail(
                        `Package ${pkg} contains peer dependencies that must be specified`
                    );

                    console.log('==========');
                    console.error(
                        `You can fix this error by doing the following:
    1. Globally publish an appropriate version of "${dep}"
    2. Republish ${pkg} with the --global (-g) flag to define "${dep}" as a global peer dependency "${dep}".
        Eg. -g ${dep}@1.0.0`
                    );
                    console.log('==========');

                    process.exit();
                }
            }
        }
    } catch (err) {
        checkPeerDependenciesSpinner.fail(
            'Unable to complete check for peer dependencies'
        );

        console.log('==========');
        console.error(err.message);
        console.log('==========');

        process.exit();
    }
    checkPeerDependenciesSpinner.succeed();

    const bundleSpinner = ora('Creating bundle in temp directory').start();
    try {
        const imports = {};
        if (globals.length) {
            globals.forEach(global => {
                const [moduleName, moduleVersion] = global.split('@');
                imports[
                    moduleName
                ] = `https://${BUCKET}.storage.googleapis.com/${org}/pkg/${moduleName}/${moduleVersion}/index.js`;
            });
        }

        const options = {
            onwarn: (warning, warn) => {
                // Supress logging
            },
            plugins: [
                resolve(),
                commonjs({
                    include: /node_modules/,
                }),
                esmImportToUrl({ imports }),
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

        file = join(path, `index.js`);
        modulePkgName = installedDepPkgJson.name;
        modulePkgVersion = installedDepPkgJson.version;

        const bundled = await rollup.rollup(options);
        await bundled.write({
            format: 'esm',
            file,
            sourcemap: true,
        });
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
        result = await upload({
            server,
            file,
            org,
            pkg: modulePkgName,
            version: modulePkgVersion,
            force,
        });
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
        let globals = yargs.argv.globals || yargs.argv.g;
        const force = yargs.argv.force || yargs.argv.f;
        const server = yargs.argv.server;
        if (globals) {
            if (globals === true) {
                console.error('flag --globals (-g) requires an argument');
                process.exit();
            }
            globals = Array.isArray(globals) ? globals : [globals];
            globals.forEach(global => {
                if (!global.includes('@')) {
                    console.error(
                        'flag --globals (-g) expects argument of the form <pkg>@<version>. eg. react@16.8.0'
                    );
                    process.exit();
                }
                // check package exists
                const cmdout = execSync(`npm show ${global} --loglevel=silent`);
                if (!cmdout.toString().trim()) {
                    console.error(
                        'flag --globals (-g) expects argument to contain valid package name and version eg. react@16.8.0'
                    );
                    process.exit();
                }
            });
        }
        main(pkg, org, server, globals, !!force);
    } catch (err) {
        console.error(err);
    }
}
