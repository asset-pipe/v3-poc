The asset service has the following URI structure


## Modules

Modules are packages of files to be loaded by a browser. Modules are versioned and consist of one or multiple files. A module is imutable.

### Method: `GET`

Retrieves files from a module at the service.

```bash
https://:assetServerUrl:port/:org/assets/:type/:name/:version/:extras
```

URL parameters:

* `:org` is the name of your organisation.
* `:type` is the type of the package, can be `js` or `css`.
* `:name` is the name of the package.
* `:version` is the version of the package.
* `:extras` whildcard pathname to any file in the package

Status codes:

* `200` if file is successfully retrieved
* `404` if file is not found

Example:

```bash
curl http://localhost:4001/finn/assets/js/lit-html/16.8.6/index.js
curl http://localhost:4001/finn/assets/js/lit-html/16.8.6/lib/util/parser.js
```

### Method: `PUT`

Places a module at the service.

```bash
https://:assetServerUrl:port/:org/assets/:type/:name/:version
```

URL parameters:

* `:org` is the name of your organisation.
* `:type` is the type of the package, can be `js` or `css`.
* `:name` is the name of the package.
* `:version` is the version of the package.

Form parameters:

* `:filedata` a `tar` or `tar.gz` containing the package

Status codes:

* `201` if module is successfully uploaded
* `400` if validation in URL parameters or form fields fails
* `409` if module already exist
* `415` if file format of the uploaded file is unsupported


## Aliases


## Import Maps