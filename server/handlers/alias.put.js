'use strict';

const multer = require('multer');
const semver = require('semver');
const { Storage } = require('@google-cloud/storage');
const aliasMiddleware = require('../middleware/alias');

const storage = new Storage();
const upload = multer({ dest: 'tmp/' });

module.exports.middleware = options => [
    upload.fields([
        { name: 'version', maxCount: 1 },
        { name: 'subtype', maxCount: 1 },
        { name: 'file', maxCount: 1 },
    ]),
    aliasMiddleware(options),
];

module.exports.handler = options => async (req, res) => {
    const { HOST, PORT, BUCKET } = options;
    const { aliases } = res.locals;
    const { org, type, name, alias } = req.params;
    let subtype;
    let file;
    let version;

    if (req.body.data) {
        try {
            const data = JSON.parse(req.body.data);
            if (data.version) version = data.version;
            if (data.subtype) subtype = data.subtype;
            if (data.file) file = data.file;
        } catch (err) {
            throw new TypeError(
                `Invalid 'data' payload. Must be a JSON string.`
            );
        }
    }

    if (typeof org !== 'string' || org === '') {
        throw new TypeError(
            ':org is a required url parameter and must be a string'
        );
    }

    if (typeof type !== 'string' || type === '') {
        throw new TypeError(
            ':type is a required url parameter and must be a string'
        );
    }

    if (typeof name !== 'string' || name === '') {
        throw new TypeError(
            ':name is a required url parameter and must be a string'
        );
    }

    if (typeof alias !== 'string' || alias === '') {
        throw new TypeError(
            ':alias is a required url parameter and must be a string'
        );
    }

    if (!semver.valid(version)) {
        throw new TypeError('INVALID SEMVER VALUE');
    }

    if (!subtype) {
        if (type === 'js') subtype = 'esm';
        if (type === 'css') subtype = 'default';
    }

    if (!file) {
        if (type === 'js') file = 'index.js';
        if (type === 'css') file = 'index.css';
    }

    aliases[org][type][name] = aliases[org][type][name] || {};
    aliases[org][type][name][alias] = { version, subtype, file };

    await storage
        .bucket(BUCKET)
        .file(`${org}/${type}/alias.json`)
        .save(JSON.stringify(aliases[org][type], null, 2));

    res.send({
        success: true,
        url: `${HOST}:${PORT}/a/${org}/${type}/${name}/${alias}`,
    });
};
