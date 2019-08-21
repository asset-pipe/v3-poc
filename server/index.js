'use strict';

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { safeHandler: _ } = require('./utils');

process.env.GOOGLE_APPLICATION_CREDENTIALS = __dirname + '/gcloud.json';

// TODO: get from environment/config
const {
    HOST = 'http://localhost',
    PORT = 4001,
    BUCKET = 'asset-pipe-v3',
} = process.env;

const options = { HOST, PORT, BUCKET };

const app = express();

app.use(cors());

// mount routes
for (const { type, path, middleware, handler } of routes) {
    const m = middleware(options);
    const mid = Array.isArray(m) ? m : [m];
    app[type](path, mid.map(i => _(i)), _(handler(options)));
}

module.exports = app;

if (!module.parent) {
    app.listen(PORT, () => {
        console.log(`started on port ${PORT}`);
    });
}
