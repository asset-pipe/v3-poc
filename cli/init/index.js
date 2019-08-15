'use strict';

const fs = require('fs');
const { resolvePath } = require('../utils');

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
