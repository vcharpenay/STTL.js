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

Instead of a remote SPARQL endpoint, a callback function returning results as SPARQL JSON
can be given as argument of `sttl.connect()`. See [`/examples`](examples) for a CLI and
example templates.

## Build

```sh
$ npm install
$ npm run-script build
$ npm test
```

To use in the browser:

```
$ npm run-script build-browser
```