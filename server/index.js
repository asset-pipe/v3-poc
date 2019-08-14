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
    HOST = 'http://localhost',
    PORT = 4001,
    BUCKET = 'asset-pipe-v3',
} = process.env;

const app = express();
const upload = multer({ dest: 'tmp/' });

async function unlinkFiles(...paths) {
    return Promise.all(paths.map(path => unlink(path)));
}

const storage = new Storage();

const aliases = {};

const aliasMiddleware = async (req, res, next) => {
    try {
        req.body = req.body || {};
        const organisation = req.body.org || req.params.org;

        if (!aliases[organisation]) {
            const [exists] = await storage
                .bucket(BUCKET)
                .file(`${organisation}/alias.json`)
                .exists();

            if (!exists) {
                await storage
                    .bucket(BUCKET)
                    .file(`${organisation}/alias.json`)
                    .save('{}');
            }

            const [contents] = await storage
                .bucket(BUCKET)
                .file(`${organisation}/alias.json`)
                .download();

            const parsed = JSON.parse(contents);
            aliases[organisation] = parsed;
        }

        next();
    } catch (err) {
        console.error(err);
        next();
    }
};

app.use(cors());

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
                        url: `${HOST}:${PORT}/${organisation}/pkg/${name}/${version}/index.js`,
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
                url: `${HOST}:${PORT}/${organisation}/pkg/${name}/${version}/index.js`,
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
    aliasMiddleware,
    async (req, res) => {
        try {
            const organisation = req.body.org;
            const name = req.body.pkg;
            const version = req.body.version;
            const alias = req.body.alias;

            console.log(aliases);

            if (!semver.valid(version)) {
                throw new Error('INVALID SEMVER VALUE');
            }

            if (!aliases[organisation]) aliases[organisation] = {};
            aliases[organisation][name] = { [alias]: version };

            await storage
                .bucket(BUCKET)
                .file(`${organisation}/alias.json`)
                .save(JSON.stringify(aliases[organisation], null, 2));

            res.send({
                success: true,
                url: `${HOST}:${PORT}/${organisation}/alias/${name}/${alias}/index.js`,
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
    '/global/map/set',
    upload.fields([
        { name: 'org', maxCount: 1 },
        { name: 'bare', maxCount: 1 },
        { name: 'pkg', maxCount: 1 },
    ]),
    async (req, res) => {
        let organisation = '';
        let type = '';

        try {
            const pkg = req.body.pkg;
            organisation = req.body.org;
            type = req.body.type;

            // TODO: input validation

            const [exists] = await storage
                .bucket(BUCKET)
                .file(`${organisation}/import-map.${type}.json`)
                .exists();

            if (!exists) {
                await storage
                    .bucket(BUCKET)
                    .file(`${organisation}/import-map.${type}.json`)
                    .save('{"imports": {}}');
            }

            // get import map if exists
            const [contents] = await storage
                .bucket(BUCKET)
                .file(`${organisation}/import-map.${type}.json`)
                .download();
            const importMap = JSON.parse(contents);

            // convert pkg into correct value if necessary
            let val = pkg;
            if (pkg.includes('@')) {
                const [left, right] = pkg.trim().split('@');
                if (semver.valid(right)) {
                    // specific version
                    val = `${HOST}:${PORT}/${organisation}/pkg/${left}/${right}/index.${type}`;
                    // TODO: check for existence
                } else {
                    // assume an alias
                    val = `${HOST}:${PORT}/${organisation}/alias/${left}/${right}/index.${type}`;
                    // TODO: check for existence
                }
            }

            // set imports[bare] = value
            importMap.imports[req.body.bare] = val;

            // save import map
            await storage
                .bucket(BUCKET)
                .file(`${organisation}/import-map.${type}.json`)
                .save(JSON.stringify(importMap, null, 2));

            res.send({
                success: true,
                url: `${HOST}:${PORT}/${organisation}/import-map.${type}.json`,
            });
        } catch (err) {
            console.error(err);
            res.send({
                success: false,
                url: `${HOST}:${PORT}/${organisation}/import-map.${type}.json`,
            });
        }
    }
);

app.post(
    '/global/map/unset',
    upload.fields([
        // org name
        { name: 'org', maxCount: 1 },
        // the name of the bare import
        { name: 'bare', maxCount: 1 },
        // js or css
        { name: 'type', maxCount: 1 },
    ]),
    async (req, res) => {
        let organisation = '';
        let type = '';

        // TODO: input validation

        try {
            organisation = req.body.org;
            type = req.body.type;

            // get import map if exists
            const [contents] = await storage
                .bucket(BUCKET)
                .file(`${organisation}/import-map.${type}.json`)
                .download();
            const importMap = JSON.parse(contents);

            // delete imports[bare]
            delete importMap.imports[req.body.bare];

            // save import map
            await storage
                .bucket(BUCKET)
                .file(`${organisation}/import-map.${type}.json`)
                .save(JSON.stringify(importMap, null, 2));

            res.send({
                success: true,
                url: `${HOST}:${PORT}/${organisation}/import-map.${type}.json`,
            });
        } catch (err) {
            console.error(err);
            res.send({
                success: false,
                url: `${HOST}:${PORT}/${organisation}/import-map.${type}.json`,
            });
        }
    }
);

app.post(
    '/publish',
    upload.fields([
        { name: 'org', maxCount: 1 },
        // app name
        { name: 'name', maxCount: 1 },
        // app version
        { name: 'version', maxCount: 1 },
        // main js bundle file with any global imports replaced
        { name: 'main:js', maxCount: 1 },
        // main css bundle file with any global imports replaced
        { name: 'main:css', maxCount: 1 },
        // fallback js bundle file for ie11 without any global imports replaced
        { name: 'fallback:js', maxCount: 1 },
        // fallback css bundle file for ie11 without any global imports replaced
        { name: 'fallback:css', maxCount: 1 },
        // map of replaced global js imports
        { name: 'preload:js', maxCount: 1 },
        // map of replaced global css imports
        { name: 'preload:css', maxCount: 1 },
    ]),
    async (req, res) => {
        // save main js file to /:org/:name/:version/index.js
        // save main css file to /:org/:name/:version/index.css
        // save fallback js file to /:org/:name/:version/fallback.js
        // save fallback css file to /:org/:name/:version/fallback.css
        // save imports js file to /:org/:name/:version/imports.js.json
        // save imports css file to /:org/:name/:version/imports.css.json
    }
);

// app.use('/', express.static('uploads'));

app.get('/:org/bundle/:name/:version/index.js', (req, res) => {
    // res.redirect(301, ...)
});

app.get('/:org/bundle/:name/:version/index.css', (req, res) => {
    // res.redirect(301, ...)
});

app.get('/:org/pkg/:name/:version/index.js', async (req, res) => {
    const { org, name, version } = req.params;
    await storage
        .bucket(BUCKET)
        .file(`/${org}/pkg/${name}/${version}/index.js`)
        .createReadStream()
        .pipe(res);
});

app.get('/:org/pkg/:name/:version/index.css', (req, res) => {
    // res.redirect(301, ...)
});

app.get('/:org/alias/:name/:alias/index.js', aliasMiddleware, (req, res) => {
    const version = aliases[req.params.org][req.params.name][req.params.alias];
    res.redirect(
        302,
        `/${req.params.org}/pkg/${req.params.name}/${version}/index.js`
    );
});

app.get('/:org/alias/:name/:alias/index.css', aliasMiddleware, (req, res) => {
    // res.redirect(302, ...)
});

app.get('/:org/map/:type', async (req, res) => {
    const { org, type } = req.params;
    await storage
        .bucket(BUCKET)
        .file(`/${org}/import-map.${type}.json`)
        .createReadStream()
        .pipe(res);
});

app.listen(PORT, () => {
    console.log('started on port 4001');
});
