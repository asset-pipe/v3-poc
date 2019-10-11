'use strict';

const HttpIncoming = require('../classes/http-incoming');
const HttpOutgoing = require('../classes/http-outgoing');
const ImportMapEntry = require('../classes/import-map-entry');
const { Duplex } = require('stream');
const ImportMap = require('../classes/import-map');
const Busboy = require('busboy');
const utils = require('../utils/utils');

const Parser = class Parser extends Duplex {
    constructor(sink, incoming) {
        super();

        this._entry = new ImportMapEntry();
        this.sink = sink;

        this.parser = new Busboy({
            headers: incoming.headers,
            limits: {
                fileSize: 100000
            }
        });

        this.parser.on('field', (name, value, fieldnameTruncated, valTruncated, encoding, mimetype) => {
            if (name === 'specifier') {
                this._entry.specifier = value;
            }

            if (name === 'address') {
                this._entry.address = value;
            }
        });

        this.parser.on('partsLimit', () => {
            const error = new Error('Payload Too Large')
            this.destroy(error);
        });

        this.parser.on('filesLimit', () => {
            const error = new Error('Payload Too Large')
            this.destroy(error);
        });

        this.parser.on('fieldsLimit', () => {
            const error = new Error('Payload Too Large')
            this.destroy(error);
        });

        this.parser.on('finish', async () => {
            // Check if entry has specifier and address
            if (!this._entry.valid()) {
                throw new Error('Map Entry is not valid');
            }

            // Read existing import map from sink
            const path = ImportMap.buildPath(incoming.org, incoming.type, incoming.name);
            let obj = {};
            try {
                obj = await utils.fetchAsJSON(sink, path);
            } catch(error) {
                // TODO; log error?
            }

            // Set entry in import map and serialize it
            const map = new ImportMap(obj);
            map.setImport(this._entry);
            const buff = Buffer.from(`${JSON.stringify(map)}\n`);

            // Write import map to sink
            const writer = await this.sink.write(path);
            writer.write(buff);

            // Terminate the Duplex stream
            this.push(buff);
            this.push(null);
        });
    }

    _read() {
        // Push to readable happens in constructor
    }

    _write(chunk, enc, cb) {
        this.parser.write(chunk);
        cb();
    }

    _final(cb) {
        cb();
    }
}

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

    return new Promise((resolve, reject) => {
        const incoming = new HttpIncoming(req, {
            name,
            type,
            org,
        });

        const outgoing = new HttpOutgoing();
        const parser = new Parser(sink, incoming);

        outgoing.mimeType = 'application/octet-stream';

        incoming.request.pipe(parser).pipe(outgoing);
        resolve(outgoing);
    });
};
module.exports.handler = handler;
