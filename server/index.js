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
    '/upload',
    upload.fields([{ name: 'package', maxCount: 1 }]),
    async (req, res) => {
        try {
            const [
                organisation,
                name,
                version,
            ] = req.files.package[0].originalname
                .replace('.tgz', '')
                .split(':');
            const metaPath = join(__dirname, req.files.package[0].path);

            try {
                await storage
                    .bucket(BUCKET)
                    .file('tarballs/' + req.files.package[0].originalname)
                    .getMetadata();

                // await unlinkFiles(metaPath);
                res.status(500).send({
                    error: 'VERSION EXISTS',
                });
            } catch (err) {
                console.log(err);
            }

            if (!semver.valid(version)) {
                // await unlinkFiles(metaPath);
                throw new Error('INVALID SEMVER VALUE');
            }

            try {
                await storage.bucket(BUCKET).upload(metaPath, {
                    gzip: true,
                    destination:
                        'tarballs/' + req.files.package[0].originalname,
                    metadata: { cacheControl: 'public, max-age=31536000' },
                });
            } catch (err) {
                console.error('ERROR:', err);
            }

            await unlinkFiles(metaPath);

            res.send({ success: true });
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
