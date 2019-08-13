#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
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

async function main(metaPath = './assets.json') {
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
        // await archive({
        //     cwd: jsAssetPaths.dir,
        //     input: jsAssetPaths.file,
        //     output: __dirname + '/tmp/js.tgz',
        // });
        // await archive({
        //     cwd: cssAssetPaths.dir,
        //     input: cssAssetPaths.file,
        //     output: __dirname + '/tmp/css.tgz',
        // });
        // await archive({
        //     cwd: __dirname + '/tmp',
        //     input: ['css.tgz', 'js.tgz', metaFilename],
        //     output: __dirname + `/tmp/${organisation}:${name}:${version}.tgz`,
        // });

        const response = await upload({
            server,
            pkg: __dirname + `/tmp/${organisation}:${name}:${version}.tgz`,
        });

        console.log(response);
    } catch (err) {
        console.error(err);
    }
}

module.exports = main;

// only do this if run as a cli
if (runningAsScript) {
    const argv = yargs.argv;
    const path = argv.path;
    main(path);
}
