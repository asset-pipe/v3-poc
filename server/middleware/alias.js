'use strict';

const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const aliases = {};
process.env.GOOGLE_APPLICATION_CREDENTIALS = __dirname + '/gcloud.json';

module.exports = options => async (req, res, next) => {
    const { BUCKET } = options;
    const { org, type } = req.params;

    if (!aliases[org]) aliases[org] = {};

    if (!aliases[org][type]) {
        aliases[org][type] = {};

        const [exists] = await storage
            .bucket(BUCKET)
            .file(`${org}/${type}/alias.json`)
            .exists();

        if (!exists) {
            await storage
                .bucket(BUCKET)
                .file(`${org}/${type}/alias.json`)
                .save(JSON.stringify(aliases[org][type], null, 2));
        }

        const [contents] = await storage
            .bucket(BUCKET)
            .file(`${org}/${type}/alias.json`)
            .download();

        const parsed = JSON.parse(contents);
        aliases[org][type] = parsed;
    }
    res.locals.aliases = aliases;

    next();
};
