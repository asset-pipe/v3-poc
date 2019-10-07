'use strict';

const { Transform } = require('stream');

class HttpOutgoing extends Transform {
    constructor() {
        super();
        this._statusCode = 200;
        this._location = '';
        this._mimeType = 'text/plain';
    }

    set statusCode(value) {
        this._statusCode = value;
    }

    get statusCode() {
        return this._statusCode;
    }

    set location(value) {
        this._location = value;
    }

    get location() {
        return this._location;
    }

    set mimeType(value) {
        this._mimeType = value;
    }

    get mimeType() {
        return this._mimeType;
    }

    _transform(data, encoding, callback) {
        this.push(data);
        callback();
    }
}
module.exports = HttpOutgoing;
