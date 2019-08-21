'use strict';

const publishGet = require('./handlers/publish.get.js');
const publishPost = require('./handlers/publish.post.js');
const aliasGet = require('./handlers/alias.get.js');
const aliasPut = require('./handlers/alias.put.js');
const aliasDelete = require('./handlers/alias.delete.js');
const importMapGet = require('./handlers/import-map.get.js');
const importMapPut = require('./handlers/import-map.put.js');
const importMapDelete = require('./handlers/import-map.delete.js');

module.exports = [
    {
        type: 'get',
        path: '/a/:org/:type/:name/:alias',
        middleware: aliasGet.middleware,
        handler: aliasGet.handler,
    },
    {
        type: 'put',
        path: '/a/:org/:type/:name/:alias',
        middleware: aliasPut.middleware,
        handler: aliasPut.handler,
    },
    {
        type: 'delete',
        path: '/a/:org/:type/:name/:alias',
        middleware: aliasDelete.middleware,
        handler: aliasDelete.handler,
    },
    {
        type: 'get',
        path: '/import-map/:org/:type',
        middleware: importMapGet.middleware,
        handler: importMapGet.handler,
    },
    {
        type: 'put',
        path: '/import-map/:org/:type/:key',
        middleware: importMapPut.middleware,
        handler: importMapPut.handler,
    },
    {
        type: 'delete',
        path: '/import-map/:org/:type/:key',
        middleware: importMapDelete.middleware,
        handler: importMapDelete.handler,
    },
    {
        type: 'get',
        path: '/:org/:type/:name/:version/:subtype?/:file?',
        middleware: publishGet.middleware,
        handler: publishGet.handler,
    },
    {
        type: 'post',
        path: '/:org/:type/:name/:version',
        middleware: publishPost.middleware,
        handler: publishPost.handler,
    },
];
