'use strict';

module.exports.middleware = () => [];

module.exports.handler = options => async (req, res) => {
    const { org, type, key } = req.params;

    // TODO: input validation

    // get import map if exists
    const [contents] = await storage
        .bucket(BUCKET)
        .file(`${org}/${type}/import-map.json`)
        .download();
    const importMap = JSON.parse(contents);

    // delete imports[key]
    delete importMap.imports[key];

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
