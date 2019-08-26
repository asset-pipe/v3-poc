'use strict';

const tempDir = require('temp-dir');
const ora = require('ora');
const mkdir = require('make-dir');
const readPkgUp = require('read-pkg-up');
const pkgDir = require('pkg-dir');
const rollup = require('rollup');
const commonjs = require('rollup-plugin-commonjs');
const rollupReplace = require('rollup-plugin-replace');
const resolve = require('rollup-plugin-node-resolve');
const { terser } = require('rollup-plugin-terser');
const esmImportToUrl = require('rollup-plugin-esm-import-to-url');
const { execSync } = require('child_process');
const { writeFileSync, createReadStream } = require('fs');
const { join, dirname } = require('path');
const { readAssetsJson, sendCommand } = require('../utils');
const v = require('../validators');

async function publishGlobalDependency(subcommands, args) {
    console.log('');
    console.log('✨', 'Asset Pipe Publish Global Dependency', '✨');
    console.log('');

    const [type, name, version] = subcommands;
    const { dryRun = false, force = false } = args;
    let { replace = [] } = args;
    let path = '';
    let server = '';
    let organisation = '';
    let installedDepBasePath = '';
    let installedDepPkgJson = {};
    let file = '';
    let modulePkgName = '';
    let modulePkgVersion = '';

    replace = Array.isArray(replace) ? replace : [replace];

    // load assets.json
    const loadAssetsFileSpinner = ora('Loading assets.json').start();
    try {
        ({ server, organisation } = readAssetsJson());
    } catch (err) {
        loadAssetsFileSpinner.fail(
            'Unable to load assets.json. Run "asset-pipe init" to generate'
        );

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    loadAssetsFileSpinner.succeed();

    // validate subcommands
    const inputValidationSpinner = ora('Validating input').start();

    if (v.version.validate(version).error) {
        inputValidationSpinner.fail(`Invalid 'semver' range given`);
        process.exit();
    }

    if (v.organisation.validate(organisation).error) {
        inputValidationSpinner.fail(
            `Invalid 'organisation' field specified in assets.json`
        );
        process.exit();
    }

    if (v.server.validate(server).error) {
        inputValidationSpinner.fail(
            `Invalid 'server' field specified in assets.json`
        );
        process.exit();
    }

    if (v.type.validate(type).error) {
        inputValidationSpinner.fail(`Invalid 'type' specified`);
        process.exit();
    }

    if (v.name.validate(name).error) {
        inputValidationSpinner.fail(`Invalid 'name' specified`);
        process.exit();
    }

    inputValidationSpinner.succeed();

    // create temp dir
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

    // create package.json in temp dir
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

    // // run npm install in temp dir
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

    // load meta info for package
    const loadingPackageMetaSpinner = ora(
        `Loading meta information for ${name} package`
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

    // package analysis
    const checkPeerDependenciesSpinner = ora(
        `Checking for peer dependencies`
    ).start();
    try {
        // console.log(installedDepPkgJson);
        // console.log(installedDepPkgJson.peerDependencies);

        if (installedDepPkgJson.peerDependencies) {
            // check that a global flag has been supplied for each
            for (const dep of Object.keys(
                installedDepPkgJson.peerDependencies
            )) {
                const globalPkgNames = replace.map(global => {
                    const [moduleName] = global.split('@');
                    return moduleName;
                });
                if (!globalPkgNames.includes(dep)) {
                    checkPeerDependenciesSpinner.fail(
                        `Package ${name} contains peer dependencies that must be referenced`
                    );

                    console.log('==========');
                    console.error(
                        `You can fix this error by performing the following 2 steps:
1. Globally publish an appropriate version of "${dep}"
2. Republish "${name}" using the --replace flag to replace "${dep}" imports with the version of "${dep}" published in 1..
   Eg. --replace ${dep}@1.0.0`
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

    // bundle
    //      handle peer deps flag
    const bundleSpinner = ora('Creating bundle in temp directory').start();
    try {
        const imports = {};
        if (replace.length) {
            replace.forEach(global => {
                const [moduleName, moduleVersion] = global.split('@');
                // TODO: handle aliases and absolute URLs as well as specific versions
                imports[
                    moduleName
                ] = `${server}/${organisation}/${type}/${moduleName}/${moduleVersion}/index.js`;
            });
        }

        const options = {
            onwarn: (warning, warn) => {
                // Supress logging
            },
            plugins: [
                esmImportToUrl({ imports }),
                resolve(),
                commonjs({
                    include: /node_modules/,
                }),
                rollupReplace({
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

    // upload
    //      handle dry run
    //      handle force flag

    if (dryRun) {
        console.log('Dry run');
        console.log('index.js', file);
        console.log('index.js.map', `${file}.map`);
        process.exit();
    }

    const uploadSpinner = ora('Uploading bundle to asset server').start();
    try {
        await sendCommand({
            method: 'POST',
            host: server,
            pathname: `/${organisation}/${type}/${name}/${version}`,
            data: JSON.stringify({
                // filename: `index.js|css`, //TODO: support setting filename via an arg
                // subtype: 'default|esm',   //TODO: support setting subtype via an arg
                force,
            }),
            file,
        });
    } catch (err) {
        uploadSpinner.fail('Unable to complete upload to asset server');
        console.log('==========');
        console.error(err);
        console.log('==========');
        process.exit();
    }
    uploadSpinner.succeed();

    console.log('');
    console.log('✨✨');
    console.log('');
}

function publishBundle(args) {
    // load assets.json
    let server = '';
    let organisation = '';

    const loadAssetsFileSpinner = ora('Loading assets.json').start();
    try {
        ({ server, organisation } = readAssetsJson());
    } catch (err) {
        loadAssetsFileSpinner.fail(
            'Unable to load assets.json. Run "asset-pipe init" to generate'
        );

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    loadAssetsFileSpinner.succeed();
    // load import map file
    // bundle
    //      use import map file
    // upload
    //      handle dry run
    //      handle force flag
}

async function command(subcommands, args) {
    if (!subcommands[0]) {
        publishBundle(args);
    } else {
        publishGlobalDependency(subcommands, args);
    }
}

module.exports = command;
