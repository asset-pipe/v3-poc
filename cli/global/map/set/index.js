#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const FormData = require('form-data');
const ora = require('ora');

function sendCommand({ server, org, pkg, bare, type } = {}) {
    const form = new FormData();
    form.append('org', org);
    form.append('pkg', pkg);
    form.append('bare', bare);
    form.append('type', type);

    return new Promise((resolve, reject) => {
        form.submit(`${server}/global/map/set`, (err, res) => {
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

async function main({
    org = '', // finn
    bare = '', // react
    pkg = '', // react@16.8.6 or react@^16 or http://someurl or  /asd/asd/asd
    server = 'http://localhost:4001',
    type,
}) {
    console.log('');
    console.log('✨', 'Asset Pipe Global Map Set', '✨');
    console.log('');

    let result = {};

    const inputValidationSpinner = ora('Validating input').start();

    if (!pkg) {
        inputValidationSpinner.fail(
            `Invalid package name and/or version given`
        );
        process.exit();
    }

    if (!org) {
        inputValidationSpinner.fail(
            `Value for 'org' is required but was not provided`
        );
        process.exit();
    }

    if (!bare) {
        inputValidationSpinner.fail(
            `Value for 'bare' is required but was not provided`
        );
        process.exit();
    }

    inputValidationSpinner.succeed();

    const sendCommandSpinner = ora(
        'Requesting import map set from asset server'
    ).start();

    try {
        result = await sendCommand({
            server,
            org,
            pkg,
            bare,
            type,
        });
        if (result.error) {
            sendCommandSpinner.text = `${
                sendCommandSpinner.text
            } (failed to set import map)`;
        }
    } catch (err) {
        sendCommandSpinner.fail('Unable to complete map set command');

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
        const [bare, pkg] = yargs.argv._;
        const org = yargs.argv.org;
        const type = yargs.argv.type;
        const server = yargs.argv.server;

        main({ org, pkg, bare, server, type });
    } catch (err) {
        console.error(err);
    }
}
