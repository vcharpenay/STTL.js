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

```
$ npm install
$ npm run-script build
$ npm test
```

To use in the browser (requires [Browserify](http://browserify.org/)):

```
$ browserify src/sttl.js -s sttl -o bin/sttl-browser.js
```