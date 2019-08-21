'use strict';

const aliasMiddleware = require('../middleware/alias');

module.exports.middleware = options => aliasMiddleware(options);

module.exports.handler = options => (req, res) => {
    const { BUCKET } = options;
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

    try {
        const { version, subtype, file } = aliases[org][type][name][alias];
        res.redirect(
            302,
            `https://${BUCKET}.storage.googleapis.com/${org}/${type}/${name}/${version}/${subtype}/${file}`
        );
    } catch (err) {
        res.sendStatus(404);
    }
};
