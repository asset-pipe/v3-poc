'use strict';

const rimraf = require('rimraf');
const path = require('path');
const fs = require('fs');

/**
 * A sink for persisting files to local file system
 *
 * @class SinkFS
 */

class SinkFS {
    constructor() {
        this._dir = '/home/trygve/Dev/asset-pipe/v3-poc/server/tmp';
    }

    async write(filePath) {
        const pathname = path.join(this._dir, filePath);
        const dir = path.dirname(pathname)

        await fs.promises.mkdir(dir, {
            recursive: true,
        });

        return fs.createWriteStream(pathname, {
            autoClose: true,
            emitClose: true,
        });
    }

    read(filePath) {
        const pathname = path.join(this._dir, filePath);
        return fs.createReadStream(pathname, {
            autoClose: true,
            emitClose: true,
        });
    }

    delete(filePath) {
        const pathname = path.join(this._dir, filePath);
        const dir = path.dirname(pathname)

        return new Promise((resolve, reject) => {
            rimraf(dir, error => {
                if (error) return reject(error);
                resolve();
            });
        });
    }
}
module.exports = SinkFS;
