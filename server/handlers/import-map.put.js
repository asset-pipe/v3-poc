'use strict';

const multer = require('multer');

const upload = multer({ dest: 'tmp/' });

module.exports.middleware = () =>
    upload.fields([{ name: 'value', maxCount: 1 }]);

module.exports.handler = options => async (req, res) => {
    const { org, type, bare } = req.params;
    const { value: pkg } = req.body;

    // TODO: input validation

    let importMap = { imports: {} };

    const [exists] = await storage
        .bucket(BUCKET)
        .file(`${org}/${type}/import-map.json`)
        .exists();

    if (exists) {
        // get import map if exists
        const [contents] = await storage
            .bucket(BUCKET)
            .file(`${org}/${type}/import-map.json`)
            .download();
        importMap = JSON.parse(contents);
    }

    // convert pkg into correct value if necessary
    let val = pkg;
    if (pkg.includes('@')) {
        const [left, right] = pkg.trim().split('@');
        if (semver.valid(right)) {
            // specific version
            val = `${HOST}:${PORT}/${org}/pkg/${left}/${right}/index.${type}`;
            // TODO: check for existence
        } else {
            // assume an alias
            val = `${HOST}:${PORT}/${org}/alias/${left}/${right}/index.${type}`;
            // TODO: check for existence
        }
    }

    // set imports[bare] = value
    importMap.imports[bare] = val;

    // save import map
    await storage
        .bucket(BUCKET)
        .file(`${org}/${type}/import-map.json`)
        .save(JSON.stringify(importMap, null, 2));

    res.send({
        success: true,
        url: `${HOST}:${PORT}/${org}/${type}/import-map.json`,
    });
};
