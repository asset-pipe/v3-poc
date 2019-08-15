'use strict';

const semver = require('semver');
const fs = require('fs');
const { resolvePath } = require('../utils');

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
