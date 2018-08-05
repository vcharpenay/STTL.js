# STTL

The [SPARQL Template Transformation Language (STTL)](http://ns.inria.fr/sparql-template/)
is a specification to turn RDF graphs into character strings, e.g. for HTML rendering
or syntax convertion.

## Quickstart

```js
const sttl = require('sttl');

// configuration
sttl.connect('a SPARQL endpoint URL');
sttl.register(
  'template { ?in " " ?p " " ?o " ." }' +
  'where { ?in ?p ?o . filter (isURI(?in) && isURI(?o)) }'
);

// Promise-based API
sttl.applyTemplates().then(ntriples => console.log(ntriples));
```

## Build

```sh
$ npm install
$ npm run-script build
$ export STTL_SPARQL_ENDPOINT=... # assuming Linux
$ npm test
```

A external SPARQL query/update endpoint is required for tests.
Its URL must be provided before running tests via the environment
variabl `STTL_SPARQL_ENDPOINT`.

To use in the browser:

```
$ npm run-script build-browser
```