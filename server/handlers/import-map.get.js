'use strict';

module.exports.middleware = () => [];

module.exports.handler = options => (req, res) => {
    const { org, type } = req.params;

    if (!org || !type) {
        res.sendStatus(404);
        return;
    }

    res.redirect(
        301,
        `https://${BUCKET}.storage.googleapis.com/${org}/${type}/import-map.json`
    );
};
