'use strict';

const { Storage } = require('@google-cloud/storage');
const File = require('../classes/file');

/**
 * A sink for uploading files to Google Cloud Storage
 *
 * @class SinkGCS
 */

class SinkGCS {
    constructor() {
        this._storage = new Storage();
        this._bucket = this._storage.bucket('asset_pipe_v3');
    }

    /**
     * @param {File} file A File object describing the file to be uploaded
     * @returns stream.Writable
     * @memberof SinkGCS
     **/

    write(file) {
        if(!(file instanceof File)) throw new TypeError('Argument "file" must be an instance of File');
        const src = this._bucket.file(file.path);
        return src.createWriteStream({
            resumable: false,
            metadata: {
                cacheControl: 'public, max-age=31536000',
                contentType: file.type,
            },
            gzip: true,
        });
    }

    /**
     * @param {File} file A File object describing the file to be downloaded
     * @returns stream.Readable
     * @memberof SinkGCS
     **/

    read(file) {
        if(!(file instanceof File)) throw new TypeError('Argument "file" must be an instance of File');
        const src = this._bucket.file(file.path);
        return src.createReadStream();
    }

    delete(file) {
        if(!(file instanceof File)) throw new TypeError('Argument "file" must be an instance of File');

    }
}
module.exports = SinkGCS;
