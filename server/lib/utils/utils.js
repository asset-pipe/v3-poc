'use strict';

const { Writable, pipeline } = require('stream');

const fetchAsJSON = (sink, path) => {
    return new Promise((resolve, reject) => {
        const buffer = [];

        const from = sink.read(path);

        const to = new Writable({
            objectMode: false,
            write(chunk, encoding, callback) {
                buffer.push(chunk);
                callback();
            },
        });

        pipeline(from, to, (error) => {
            if (error) return reject(error);
            const str = buffer.join().toString();
            try {
                const obj = JSON.parse(str);
                resolve(obj);
            } catch(err) {
                reject(err);
            }
        });
    });
};
module.exports.fetchAsJSON = fetchAsJSON;
