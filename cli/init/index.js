#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const fs = require('fs');
const path = require('path');

const runningAsScript = !module.parent;

function resolvePath(pathname) {
    if (!path.isAbsolute(pathname)) {
        pathname = path.normalize(`${process.cwd()}/${pathname}`);
    }

    const { dir, base: file } = path.parse(pathname);
    return { dir, file, pathname };
}

async function main(metaPath = './assets.json') {
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
            },
            null,
            2
        )
    );
    console.log(`assets.json file created`);
}

module.exports = main;

// only do this if run as a cli
if (runningAsScript) {
    const argv = yargs.argv;
    const path = argv.path;
    main(path);
}
