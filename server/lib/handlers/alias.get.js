'use strict';

const { Writable, pipeline } = require('stream');
const HttpOutgoing = require('../classes/http-outgoing');
const Alias = require('../classes/alias');

const collector = (input) => {
    return new Promise((resolve, reject) => {
        const buffer = [];

        const stream = new Writable({
            objectMode: false,
            write(chunk, encoding, callback) {
                buffer.push(chunk);
                callback();
            },
        });

        pipeline(input, stream, (error) => {
            if (error) return reject(error);
            resolve(buffer.join().toString());
        });
    });
};

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

const handler = (sink, req, org, type, name, alias, extra) => {
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

    return new Promise(async (resolve, reject) => {
        const path = Alias.buildPath(org, type, name, alias);
        const stream = sink.read(path);

        // TODO; try/catch
        const result = await collector(stream);
        const obj = JSON.parse(result);

        const location = Alias.buildPathname(obj.org, obj.type, obj.name, obj.version, extra);

        const outgoing = new HttpOutgoing();
        outgoing.mimeType = 'application/json';
        outgoing.statusCode = 302;
        outgoing.location = location;

        resolve(outgoing);
    });
};
module.exports.handler = handler;
