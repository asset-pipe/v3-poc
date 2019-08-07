#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const FormData = require('form-data');
const semver = require('semver');
const ora = require('ora');

const BUCKET = 'asset-pipe-v3';

function sendCommand({ server, org, pkg, version, alias, force = false } = {}) {
    const form = new FormData();
    form.append('org', org);
    form.append('pkg', pkg);
    form.append('version', version);
    form.append('alias', alias);
    form.append('force', force ? 'true' : 'false');

    return new Promise((resolve, reject) => {
        form.submit(`${server}/global/alias`, (err, res) => {
            if (err) return reject(err);

            res.once('data', chunk => {
                try {
                    resolve(JSON.parse(chunk.toString()));
                } catch (err) {
                    resolve({
                        error: 'Unable to connect to server or server failure',
                    });
                }
            });
        });
    });
}

async function main(
    org = '',
    pkg = '',
    alias = '',
    server = 'http://localhost:4001',
    force = false
) {
    console.log('');
    console.log('✨', 'Asset Pipe Global Alias', '✨');
    console.log('');

    let result = {};

    const inputValidationSpinner = ora('Validating input').start();

    if (!pkg.includes('@')) {
        inputValidationSpinner.fail(
            `Invalid package name and/or version given`
        );
        process.exit();
    }

    const [name, version] = pkg.trim().split('@');

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

    if (!alias) {
        inputValidationSpinner.fail(
            `Value for 'alias' is required but was not provided`
        );
        process.exit();
    }

    inputValidationSpinner.succeed();

    const sendCommandSpinner = ora(
        'Requesting alias creation from asset server'
    ).start();
    try {
        result = await sendCommand({
            server,
            org,
            pkg: name,
            alias,
            version,
            force,
        });
        if (result.error) {
            sendCommandSpinner.text = `${
                sendCommandSpinner.text
            } (alias already exists)`;
        }
    } catch (err) {
        sendCommandSpinner.fail('Unable to complete alias command');

        console.log('==========');
        console.error(err);
        console.log('==========');

        process.exit();
    }
    sendCommandSpinner.succeed();

    console.log('');
    console.log('✨', result.url, '✨');
    console.log('');
}

module.exports = main;

if (!module.parent) {
    try {
        // process args
        const [pkg, alias] = yargs.argv._;
        const org = yargs.argv.org;
        const force = yargs.argv.force || yargs.argv.f;
        const server = yargs.argv.server;

        main(org, pkg, alias, server, !!force);
    } catch (err) {
        console.error(err);
    }
}
