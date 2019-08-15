'use strict';

const FormData = require('form-data');
const ora = require('ora');

function sendCommand({ server, org, bare, type } = {}) {
    const form = new FormData();
    form.append('org', org);
    form.append('bare', bare);
    form.append('type', type);

    return new Promise((resolve, reject) => {
        form.submit(`${server}/global/map/unset`, (err, res) => {
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
    server = 'http://localhost:4001',
    type,
}) {
    console.log('');
    console.log('✨', 'Asset Pipe Global Map Unset', '✨');
    console.log('');

    let result = {};

    const inputValidationSpinner = ora('Validating input').start();

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
        'Requesting import map unset from asset server'
    ).start();

    try {
        result = await sendCommand({
            server,
            org,
            bare,
            type,
        });
        if (result.error) {
            sendCommandSpinner.text = `${
                sendCommandSpinner.text
            } (failed to unset import map)`;
        }
    } catch (err) {
        sendCommandSpinner.fail('Unable to complete map unset command');

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
