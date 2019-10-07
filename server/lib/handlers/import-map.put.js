'use strict';

const multer = require('multer');
const { Storage } = require('@google-cloud/storage');

const upload = multer({ dest: 'tmp/' });
const storage = new Storage();

module.exports.middleware = () =>
    upload.fields([{ name: 'value', maxCount: 1 }]);

module.exports.handler = options => async (req, res) => {
    const { BUCKET, HOST, PORT } = options;
    const { org, type, bare } = req.params;
    const { value: val } = req.body;

    // TODO: input validation

    let importMap = { imports: {} };

    const [exists] = await storage
        .bucket(BUCKET)
        .file(`${org}/${type}/import-map.json`)
        .exists();

    if (exists) {
        const [contents] = await storage
            .bucket(BUCKET)
            .file(`${org}/${type}/import-map.json`)
            .download();
        importMap = JSON.parse(contents);
    }

    importMap.imports[bare] = val;

    await storage
        .bucket(BUCKET)
        .file(`${org}/${type}/import-map.json`)
        .save(JSON.stringify(importMap, null, 2));

    res.send({
        success: true,
        url: `${HOST}:${PORT}/import-map/${org}/${type}`,
    });
};
