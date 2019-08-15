#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const semver = require('semver');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const tar = require('tar');
const mkdir = require('make-dir');

const initCmd = require('./init');
const versionCmd = require('./version');
const publishCmd = require('./publish');
const globalPublishCmd = require('./global/publish');
const globalAliasCmd = require('./global/alias');
const globalMapSet = require('./global/map/set');
const globalMapUnset = require('./global/map/unset');

const runningAsScript = !module.parent;

function resolvePath(pathname) {
    if (!path.isAbsolute(pathname)) {
        pathname = path.normalize(`${process.cwd()}/${pathname}`);
    }

    const { dir, base: file } = path.parse(pathname);
    return { dir, file, pathname };
}

// function upload({ server, pkg } = {}) {
//     const form = new FormData();
//     form.append('package', fs.createReadStream(pkg));

//     return new Promise((resolve, reject) => {
//         form.submit(`${server}/upload`, (err, res) => {
//             if (err) return reject(err);

//             res.once('data', chunk => {
//                 resolve(chunk.toString());
//             });
//         });
//     });
// }

// function archive({ cwd, input, output, gzip = true }) {
//     if (!Array.isArray(input)) input = [input];
//     return tar.create({ file: output, gzip, cwd }, input);
// }

async function main(
    command,
    subcommands,
    {
        metaPath = './assets.json',
        global = false,
        organisation = '',
        force = false,
        server = '',
        replaceBareImports = [],
        name = '',
        type = 'js',
    }
) {
    if (global) {
        // TODO: validate global namespace
        if (command === 'alias') {
            globalAliasCmd(
                organisation,
                subcommands[0],
                subcommands[1],
                server,
                force
            );
        } else if (command === 'publish') {
            globalPublishCmd(
                subcommands[0],
                organisation,
                server,
                replaceBareImports,
                force
            );
        } else if (command === 'map') {
            if (subcommands[0] === 'set') {
                globalMapSet({
                    server,
                    org: organisation,
                    bare: subcommands[1],
                    pkg: subcommands[2],
                    type,
                });
            } else if (subcommands[0] === 'unset') {
                globalMapUnset({
                    server,
                    org: organisation,
                    bare: subcommands[1],
                    type,
                });
            }
        }
    } else if (command === 'publish') {
        publishCmd();
    } else if (command === 'version') {
        versionCmd(subcommands[0], metaPath);
    } else if (command === 'init') {
        initCmd(metaPath);
    }
}

module.exports = {
    global: {
        alias: globalAliasCmd,
        publish: globalPublishCmd,
        map: {
            set: globalMapSet,
            unset: globalMapUnset,
        },
    },
    publish: publishCmd,
    version: versionCmd,
    init: initCmd,
};

// only do this if run as a cli
if (runningAsScript) {
    const argv = yargs.argv;
    const [command, ...subcommands] = argv._;
    const metaPath = argv.path || './assets.json';
    let name = yargs.argv.name || yargs.argv.n;
    let organisation = yargs.argv.org || yargs.argv.o;
    let server = yargs.argv.server || yargs.argv.s;
    const global = yargs.argv.global || yargs.argv.g;
    const force = yargs.argv.force || yargs.argv.f;
    const type = yargs.argv.type || yargs.argv.t;
    const replaceBareImports = yargs.argv.replaceBareImports || yargs.argv.r;

    try {
        const assetsFilePath = resolvePath(metaPath);
        const assetsJSON = require(assetsFilePath.pathname);

        if (!organisation && assetsJSON.organisation) {
            organisation = assetsJSON.organisation;
        }
        if (!name && assetsJSON.name) {
            name = assetsJSON.name;
        }
        if (!server && assetsJSON.server) {
            server = assetsJSON.server;
        }
    } catch (err) {}

    if (replaceBareImports) {
        if (replaceBareImports === true) {
            console.error(
                'flag --replaceBareImports (-r) requires an argument'
            );
            process.exit();
        }
        globals = Array.isArray(replaceBareImports)
            ? replaceBareImports
            : [replaceBareImports];
        replaceBareImports.forEach(dep => {
            if (!dep.includes('@')) {
                console.error(
                    'flag --replaceBareImports (-r) expects argument of the form <pkg>@<version>. eg. react@16.8.0'
                );
                process.exit();
            }
            // check package exists
            const cmdout = execSync(`npm show ${dep} --loglevel=silent`);
            if (!cmdout.toString().trim()) {
                console.error(
                    'flag --replaceBareImports (-r) expects argument to contain valid package name and version eg. react@16.8.0'
                );
                process.exit();
            }
        });
    }

    main(command, subcommands, {
        organisation,
        global,
        force,
        server,
        replaceBareImports,
        metaPath,
        name,
        type,
    });
}
