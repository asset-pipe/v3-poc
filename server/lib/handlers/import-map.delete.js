'use strict';

const HttpOutgoing = require('../classes/http-outgoing');
const ImportMap = require('../classes/import-map');

const params = {
    type: 'object',
    properties: {
        alias: {
          type: 'string',
          minLength: 1,
          maxLength: 64,
          pattern: "^[a-zA-Z0-9_-]*$"
        },
        type: { type: 'string' },
        name: { type: 'string' },
        org: { type: 'string' },
    }
};
module.exports.params = params;

const handler = (sink, req, org, type, name) => {
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

    return new Promise(async (resolve, reject) => {
        const path = ImportMap.buildPath(org, type, name);

        // TODO; try/catch
        const result = await sink.delete(path);

        console.log(result);

        const outgoing = new HttpOutgoing();
        outgoing.mimeType = 'plain/text';
        outgoing.statusCode = 204;
        outgoing.push(null);

        resolve(outgoing);
    });
};
module.exports.handler = handler;
