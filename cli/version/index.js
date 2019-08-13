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

async function main(semverType, metaPath = './assets.json') {
    const pathToMeta = resolvePath(metaPath).pathname;
    const meta = JSON.parse(fs.readFileSync(pathToMeta));

    if (!semverType || !['major', 'minor', 'patch'].includes(semverType)) {
        console.error(
            'invalid semver type supplied. Use "major", "minor" or "patch" eg. asset-pipe version minor'
        );
        return;
    }
    meta.version = semver.inc(meta.version, semverType);
    fs.writeFileSync(pathToMeta, JSON.stringify(meta, null, 2));
    console.log(
        `Version ${meta.version} set. Run "asset-pipe publish" to publish`
    );
}

module.exports = main;

// only do this if run as a cli
if (runningAsScript) {
    const argv = yargs.argv;
    const path = argv.path;
    const commands = argv._;
    main(commands[0], path);
}
