'use strict';

const semver = require('semver');

module.exports.middleware = () => [];

module.exports.handler = options => (req, res) => {
    const { BUCKET } = options;
    const { org, type, name, version } = req.params;
    let { subtype, file } = req.params;

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

    if (typeof version !== 'string' || version === '') {
        throw new TypeError(
            ':version is a required url parameter and must be a string'
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

    res.redirect(
        301,
        `https://${BUCKET}.storage.googleapis.com/${org}/${type}/${name}/${version}/${subtype}/${file}`
    );
};
