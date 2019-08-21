'use strict';

const multer = require('multer');
const semver = require('semver');
const tempDir = require('temp-dir');
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const upload = multer({ dest: tempDir });

module.exports.middleware = () =>
    upload.fields([
        { name: 'data', maxCount: 1 },
        { name: 'file', maxCount: 1 },
    ]);

module.exports.handler = options => async (req, res) => {
    const { org, type, name, version } = req.params;
    const { BUCKET, HOST, PORT } = options;
    const contents = req.files.file[0].path;
    let subtype;
    let file;

    if (req.body.data) {
        try {
            const data = JSON.parse(req.body.data);
            if (data.subtype) subtype = data.subtype;
            if (data.file) file = data.file;
        } catch (err) {
            throw new TypeError(
                `Invalid 'data' payload. Must be a JSON string.`
            );
        }
    }

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

    if (typeof version !== 'string' || version === '') {
        throw new TypeError(
            ':version is a required url parameter and must be a string'
        );
    }

    if (!semver.valid(version)) {
        throw new TypeError('INVALID SEMVER VALUE');
    }

    if (!subtype) {
        if (type === 'js') subtype = 'esm';
        if (type === 'css') subtype = 'default';
    }

    if (!file) {
        if (type === 'js') file = 'index.js';
        if (type === 'css') file = 'index.css';
    }

    await storage.bucket(BUCKET).upload(contents, {
        gzip: true,
        destination: `/${org}/${type}/${name}/${version}/${subtype}/${file}`,
        metadata: {
            cacheControl: 'public, max-age=31536000',
            contentType: 'application/javascript',
        },
    });

    res.send({
        success: true,
        url: `${HOST}:${PORT}/${org}/${type}/${name}/${version}/${subtype}/${file}`,
    });
};

// module.exports.handler = options => async (req, res) => {
//     const organisation = req.body.org;
//     const name = req.body.pkg;
//     const version = req.body.version;
//     const force = req.body.force === 'true' ? true : false;

//     const metaPath = join(__dirname, req.files.src[0].path);
//     const mapMetaPath = join(__dirname, req.files.map[0].path);

//     try {
//         if (!force) {
//             await storage
//                 .bucket(BUCKET)
//                 .file(`${organisation}/pkg/${name}/${version}/index.js`)
//                 .getMetadata();

//             // await unlinkFiles(metaPath);
//             res.status(500).send({
//                 error: 'VERSION EXISTS',
//                 url: `${HOST}:${PORT}/${organisation}/pkg/${name}/${version}/index.js`,
//             });
//             return;
//         }
//     } catch (err) {
//         // console.log(err);
//     }

//     if (!semver.valid(version)) {
//         // await unlinkFiles(metaPath);
//         throw new Error('INVALID SEMVER VALUE');
//     }

//     try {
//         if (force) {
//             await Promise.all([
//                 storage
//                     .bucket(BUCKET)
//                     .file(`/${organisation}/pkg/${name}/${version}/index.js`)
//                     .delete(),
//                 storage
//                     .bucket(BUCKET)
//                     .file(
//                         `/${organisation}/pkg/${name}/${version}/index.js.map`
//                     )
//                     .delete(),
//             ]);
//         }
//         await Promise.all([
//             storage.bucket(BUCKET).upload(metaPath, {
//                 gzip: true,
//                 destination: `/${organisation}/pkg/${name}/${version}/index.js`,
//                 metadata: {
//                     cacheControl: 'public, max-age=31536000',
//                     contentType: 'application/javascript',
//                 },
//             }),
//             storage.bucket(BUCKET).upload(mapMetaPath, {
//                 gzip: true,
//                 destination: `/${organisation}/pkg/${name}/${version}/index.js.map`,
//                 metadata: {
//                     cacheControl: 'public, max-age=31536000',
//                     contentType: 'application/javascript',
//                 },
//             }),
//         ]);
//     } catch (err) {
//         console.error('ERROR:', err);
//     }

//     await unlinkFiles(metaPath);

//     res.send({
//         success: true,
//         url: `${HOST}:${PORT}/${organisation}/pkg/${name}/${version}/index.js`,
//     });
// };
