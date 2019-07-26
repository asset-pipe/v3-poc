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
    upload.fields([{ name: 'file', maxCount: 1 }]),
    async (req, res) => {
        try {
            const [
                organisation,
                name,
                version,
            ] = req.files.file[0].originalname.replace('.js', '').split(':');
            const metaPath = join(__dirname, req.files.file[0].path);

            try {
                await storage
                    .bucket(BUCKET)
                    .file(`${organisation}/pkg/${name}/${version}`)
                    .getMetadata();

                // await unlinkFiles(metaPath);
                res.status(500).send({
                    error: 'VERSION EXISTS',
                    url: `https://storage.cloud.google.com/${BUCKET}/${organisation}/pkg/${name}/${version}`,
                });
                return;
            } catch (err) {
                // console.log(err);
            }

            if (!semver.valid(version)) {
                // await unlinkFiles(metaPath);
                throw new Error('INVALID SEMVER VALUE');
            }

            try {
                await storage.bucket(BUCKET).upload(metaPath, {
                    gzip: true,
                    destination: `/${organisation}/pkg/${name}/${version}`,
                    metadata: {
                        cacheControl: 'public, max-age=31536000',
                        contentType: 'application/javascript',
                    },
                });
            } catch (err) {
                console.error('ERROR:', err);
            }

            await unlinkFiles(metaPath);

            res.send({
                success: true,
                url: `https://storage.cloud.google.com/${BUCKET}/${organisation}/pkg/${name}/${version}`,
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
