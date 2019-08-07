'use strict';

const express = require('express');
const cors = require('cors');
const { readFile, stat, unlink } = require('fs').promises;
const multer = require('multer');
const tar = require('tar');
const { join } = require('path');
const mkdir = require('make-dir');
const semver = require('semver');
const { Storage } = require('@google-cloud/storage');

process.env.GOOGLE_APPLICATION_CREDENTIALS = __dirname + '/gcloud.json';

const {
    /*HOST = 'http://localhost',*/ PORT = 4001,
    BUCKET = 'asset-pipe-v3',
} = process.env;

const app = express();
const upload = multer({ dest: 'tmp/' });

async function unlinkFiles(...paths) {
    return Promise.all(paths.map(path => unlink(path)));
}

const storage = new Storage();

// receive archive of js
app.post(
    '/global/publish',
    upload.fields([
        { name: 'src', maxCount: 1 },
        { name: 'map', maxCount: 1 },
        { name: 'org', maxCount: 1 },
        { name: 'pkg', maxCount: 1 },
        { name: 'version', maxCount: 1 },
        { name: 'force', maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const organisation = req.body.org;
            const name = req.body.pkg;
            const version = req.body.version;
            const force = req.body.force === 'true' ? true : false;

            const metaPath = join(__dirname, req.files.src[0].path);
            const mapMetaPath = join(__dirname, req.files.map[0].path);

            try {
                if (!force) {
                    await storage
                        .bucket(BUCKET)
                        .file(`${organisation}/pkg/${name}/${version}/index.js`)
                        .getMetadata();

                    // await unlinkFiles(metaPath);
                    res.status(500).send({
                        error: 'VERSION EXISTS',
                        url: `https://storage.cloud.google.com/${BUCKET}/${organisation}/pkg/${name}/${version}`,
                    });
                    return;
                }
            } catch (err) {
                // console.log(err);
            }

            if (!semver.valid(version)) {
                // await unlinkFiles(metaPath);
                throw new Error('INVALID SEMVER VALUE');
            }

            try {
                if (force) {
                    await Promise.all([
                        storage
                            .bucket(BUCKET)
                            .file(
                                `/${organisation}/pkg/${name}/${version}/index.js`
                            )
                            .delete(),
                        storage
                            .bucket(BUCKET)
                            .file(
                                `/${organisation}/pkg/${name}/${version}/index.js.map`
                            )
                            .delete(),
                    ]);
                }
                await Promise.all([
                    storage.bucket(BUCKET).upload(metaPath, {
                        gzip: true,
                        destination: `/${organisation}/pkg/${name}/${version}/index.js`,
                        metadata: {
                            cacheControl: 'public, max-age=31536000',
                            contentType: 'application/javascript',
                        },
                    }),
                    storage.bucket(BUCKET).upload(mapMetaPath, {
                        gzip: true,
                        destination: `/${organisation}/pkg/${name}/${version}/index.js.map`,
                        metadata: {
                            cacheControl: 'public, max-age=31536000',
                            contentType: 'application/javascript',
                        },
                    }),
                ]);
            } catch (err) {
                console.error('ERROR:', err);
            }

            await unlinkFiles(metaPath);

            res.send({
                success: true,
                url: `https://${BUCKET}.storage.googleapis.com/${organisation}/pkg/${name}/${version}/index.js`,
            });
        } catch (err) {
            console.error(err);
            res.status(500).send({
                error: err.message,
            });
        }
    }
);

app.post(
    '/global/alias',
    upload.fields([
        { name: 'org', maxCount: 1 },
        { name: 'pkg', maxCount: 1 },
        { name: 'version', maxCount: 1 },
        { name: 'alias', maxCount: 1 },
        { name: 'force', maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const organisation = req.body.org;
            const name = req.body.pkg;
            const version = req.body.version;
            const alias = req.body.alias;
            const force = req.body.force === 'true' ? true : false;

            try {
                if (!force) {
                    await storage
                        .bucket(BUCKET)
                        .file(`${organisation}/alias/${name}/${alias}`)
                        .getMetadata();

                    res.status(500).send({
                        error: 'VERSION EXISTS',
                        url: `https://storage.cloud.google.com/${BUCKET}/${organisation}/alias/${name}/${alias}`,
                    });
                    return;
                }
            } catch (err) {
                // console.log(err);
            }

            if (!semver.valid(version)) {
                throw new Error('INVALID SEMVER VALUE');
            }

            try {
                if (force) {
                    await Promise.all([
                        storage
                            .bucket(BUCKET)
                            .file(`${organisation}/alias/${name}/${alias}`)
                            .delete(),
                        storage
                            .bucket(BUCKET)
                            .file(
                                `${organisation}/alias/${name}/${alias}/index.js.map`
                            )
                            .delete(),
                    ]);
                }
                // await Promise.all([
                //     storage.bucket(BUCKET).upload(metaPath, {
                //         gzip: true,
                //         destination: `/${organisation}/pkg/${name}/${version}/index.js`,
                //         metadata: {
                //             cacheControl: 'public, max-age=31536000',
                //             contentType: 'application/javascript',
                //         },
                //     }),
                //     storage.bucket(BUCKET).upload(mapMetaPath, {
                //         gzip: true,
                //         destination: `/${organisation}/pkg/${name}/${version}/index.js.map`,
                //         metadata: {
                //             cacheControl: 'public, max-age=31536000',
                //             contentType: 'application/javascript',
                //         },
                //     }),
                // ]);

                // TODO: copy files
                await Promise.all([
                    storage
                        .bucket(BUCKET)
                        .file(
                            `/${organisation}/pkg/${name}/${version}/index.js`
                        )
                        .copy(
                            storage
                                .bucket(BUCKET)
                                .file(`${organisation}/alias/${name}/${alias}`)
                        ),
                    storage
                        .bucket(BUCKET)
                        .file(
                            `/${organisation}/pkg/${name}/${version}/index.js.map`
                        )
                        .copy(
                            storage
                                .bucket(BUCKET)
                                .file(
                                    `${organisation}/alias/${name}/${alias}/index.js.map`
                                )
                        ),
                ]);
            } catch (err) {
                console.error('ERROR:', err);
            }

            res.send({
                success: true,
                url: `https://storage.cloud.google.com/${BUCKET}/${organisation}/alias/${name}/${alias}`,
            });
        } catch (err) {
            console.error(err);
            res.status(500).send({
                error: err.message,
            });
        }
    }
);

app.use(cors());
app.use('/', express.static('uploads'));

app.listen(PORT, () => {
    console.log('started on port 4001');
});
