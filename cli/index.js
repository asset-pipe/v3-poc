#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const semver = require('semver');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const tar = require('tar');
const mkdir = require('make-dir');

const runningAsScript = !module.parent;

function resolvePath(pathname) {
    if (!path.isAbsolute(pathname)) {
        pathname = path.normalize(`${process.cwd()}/${pathname}`);
    }

    const { dir, base: file } = path.parse(pathname);
    return { dir, file, pathname };
}

function upload({ server, pkg } = {}) {
    const form = new FormData();
    form.append('package', fs.createReadStream(pkg));

    return new Promise((resolve, reject) => {
        form.submit(`${server}/upload`, (err, res) => {
            if (err) return reject(err);

            res.once('data', chunk => {
                resolve(chunk.toString());
            });
        });
    });
}

function archive({ cwd, input, output, gzip = true }) {
    if (!Array.isArray(input)) input = [input];
    return tar.create({ file: output, gzip, cwd }, input);
}

async function main(commands, metaPath = './assets.json') {
    if (commands[0] === 'publish') {
        try {
            const { pathname: pathToMeta, file: metaFilename } = resolvePath(
                metaPath
            );
            const meta = JSON.parse(fs.readFileSync(pathToMeta));
            const { organisation, name, version, server, inputs } = meta;

            // produce archive of js
            const jsAssetPaths = resolvePath(inputs.js);
            const cssAssetPaths = resolvePath(inputs.css);

            await mkdir(__dirname + '/tmp');

            fs.writeFileSync(
                __dirname + '/tmp/' + metaFilename,
                JSON.stringify(meta, null, 2)
            );
            await archive({
                cwd: jsAssetPaths.dir,
                input: jsAssetPaths.file,
                output: __dirname + '/tmp/js.tgz',
            });
            await archive({
                cwd: cssAssetPaths.dir,
                input: cssAssetPaths.file,
                output: __dirname + '/tmp/css.tgz',
            });
            await archive({
                cwd: __dirname + '/tmp',
                input: ['css.tgz', 'js.tgz', metaFilename],
                output:
                    __dirname + `/tmp/${organisation}:${name}:${version}.tgz`,
            });

            const response = await upload({
                server,
                pkg: __dirname + `/tmp/${organisation}:${name}:${version}.tgz`,
            });

            console.log(response);
        } catch (err) {
            console.error(err);
        }
    }

    if (commands[0] === 'version') {
        const pathToMeta = resolvePath(metaPath).pathname;
        const meta = JSON.parse(fs.readFileSync(pathToMeta));

        if (
            !commands[1] ||
            !['major', 'minor', 'patch'].includes(commands[1])
        ) {
            console.error(
                'invalid semver type supplied. Use "major", "minor" or "patch" eg. asset-pipe version minor'
            );
            return;
        }
        meta.version = semver.inc(meta.version, commands[1]);
        fs.writeFileSync(pathToMeta, JSON.stringify(meta, null, 2));
        console.log(
            `Version ${meta.version} set. Run "asset-pipe publish" to publish`
        );
    }

    if (commands[0] === 'init') {
        const pathToMeta = resolvePath(metaPath).pathname;

        try {
            const st = fs.statSync(pathToMeta);
            if (st.isFile()) {
                console.log('assets meta file already exists');
                return;
            }
        } catch (err) {}

        fs.writeFileSync(
            pathToMeta,
            JSON.stringify(
                {
                    organisation: '[required]',
                    name: '[required]',
                    version: '1.0.0',
                    server: 'http://assets-server.svc.prod.finn.no',
                    inputs: {
                        js: '[path to js entrypoint]',
                        css: '[path to css entrypoint]',
                    },
                    outputs: {
                        js: '[output js filename]',
                        css: '[output css filename]',
                    },
                },
                null,
                2
            )
        );
        console.log(`assets.json file created`);
    }
}

module.exports = {
    publish() {
        main('publish');
    },
};

// only do this if run as a cli
if (runningAsScript) {
    const argv = yargs.argv;
    const path = argv.path;
    const commands = argv._;
    main(commands, path);
}
