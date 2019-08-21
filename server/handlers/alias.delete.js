'use strict';

const { Storage } = require('@google-cloud/storage');
const aliasMiddleware = require('../middleware/alias');

const storage = new Storage();

module.exports.middleware = options => aliasMiddleware(options);

module.exports.handler = options => async (req, res) => {
    const { HOST, PORT, BUCKET } = options;
    const { aliases } = res.locals;
    const { org, type, name, alias } = req.params;

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

    delete aliases[org][type][name][alias];

    await storage
        .bucket(BUCKET)
        .file(`${org}/${type}/alias.json`)
        .save(JSON.stringify(aliases[org][type], null, 2));

    res.send({
        success: true,
        url: `${HOST}:${PORT}/a/${org}/${type}/${name}/${alias}`,
    });
};
