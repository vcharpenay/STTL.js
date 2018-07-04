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

sttl.applyTemplates(); // output: triples in N-Triple format
```

## Build

```
$ npm install
```