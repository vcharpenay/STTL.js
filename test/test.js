const assert = require('assert');
const fs = require('fs');
const sttl = require('../src/sttl.js');

function setup(name) {
	let tpl = fs.readFileSync('test/templates/' + name + '.tpl', 'utf-8');
	sttl.clear();
	sttl.register(JSON.parse(tpl)); // TODO STTL syntax
}

before(() => {
	sttl.connect('http://localhost:7200/repositories/noinf');
	/* TODO install local RDF store
	let triples = fs.readFileSync('test/store.ttl', 'utf-8');
	return hylar.load(triples, 'text/turtle').then(() => {
		sttl.connect(q => hylar.query(q));
	});
	*/
});

describe('st:apply-templates', () => {
	/**
	* http://ns.inria.fr/sparql-template/#structure2
	*/
	it('2.2 Template', () => {
		setup('structure2');
		return sttl.applyTemplates().then(str => {
			// regex: N-Triples syntax (URIs only)
			assert.ok(str.match(/(<.*>\s*<.*>\s*<.*>\s*.\n)+/));
		});
	});
	
	/**
	* http://ns.inria.fr/sparql-template/#template2
	*/
	it('4.2 Template processing', () => {
		setup('template2');
		return sttl.applyTemplates().then(str => {
			assert.strictEqual(str, 'allValuesFrom(foaf:knows foaf:Person)');
		});
	});
});

describe('st:call-template', () => {
	/**
	* http://ns.inria.fr/sparql-template/#structure3
	*/
	it('2.3 Named Template', () => {
		setup('structure3');
		return sttl.applyTemplates().then(str => {
			assert.ok(false); // TODO
		});
	});
})