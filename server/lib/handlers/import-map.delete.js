'use strict';

const { Storage } = require('@google-cloud/storage');

const storage = new Storage();

module.exports.middleware = () => [];

module.exports.handler = options => async (req, res) => {
    const { BUCKET, HOST, PORT } = options;
    const { org, type, key } = req.params;

    // TODO: input validation

    const [contents] = await storage
        .bucket(BUCKET)
        .file(`${org}/${type}/import-map.json`)
        .download();
    const importMap = JSON.parse(contents);

    delete importMap.imports[key];

    await storage
        .bucket(BUCKET)
        .file(`${org}/${type}/import-map.json`)
        .save(JSON.stringify(importMap, null, 2));

    res.send({
        success: true,
        url: `${HOST}:${PORT}/import-map/${org}/${type}`,
    });
};
