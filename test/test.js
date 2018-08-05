const assert = require('assert');
const fs = require('fs');
const rdf = require('rdflib');
const sttl = require('../src/sttl.js');

function setup(...names) {
	sttl.clear();
	names.forEach(n => {
		let str = fs.readFileSync('test/templates/' + n + '.tpl', 'utf-8');
		sttl.register(str);
	});
}

function normalize(arg) {
    return (arg.startsWith('"') && arg.endsWith('"')) ?
        arg.substring(1, arg.length - 1) :
        arg;
}

before(() => {
    let endpoint = process.env.STTL_SPARQL_ENDPOINT;
    if (!endpoint) throw new Error('A SPARQL endpoint URL must be provided to run tests.');
    
    // TODO insert data?
    
    sttl.connect(normalize(endpoint));
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
	let display = 'http://example.org/ns/display';
	let alice = {
		type: 'uri',
		value: 'http://example.org/ns/Alice'
	};
		
	/**
	* http://ns.inria.fr/sparql-template/#structure3
	*/
	it('2.3 Named Template', () => {
		setup('structure3');
		return sttl.callTemplate(display, alice).then(str => {
			assert.strictEqual(str, 'ex:Bob');
		});
	});
	
	/**
	 * http://ns.inria.fr/sparql-template/#template3
	 */
	it('4.3 Named Template Processing', () => {
		setup('structure3', 'template3');
		return sttl.applyTemplates(alice).then(str => {
			assert.strictEqual(str, 'ex:Bob');
		});
	});
})

describe('Processing', () => {
	/**
	 * http://ns.inria.fr/sparql-template/#template4
	 */
    it('4.4 Result Processing', () => {
		setup('template4');
        return sttl.applyTemplates().then(str => {
            let names = str.split(', ');
            assert.strictEqual(names.length, 2);
            assert.ok(names.indexOf('"Alice"') > -1);
            assert.ok(names.indexOf('"Eve"') > -1);
        });
    });
});

describe('Statements', () => {
	/**
	 * http://ns.inria.fr/sparql-template/#statement1
	 */
	it('6.1 Conditional Processing', () => {
		setup('statement1', 'statement1-adult', 'statement1-child');
		return sttl.applyTemplates().then(str => {
			assert.ok(str.includes('ex:Alice is an adult.'));
			assert.ok(str.includes('ex:Eve is a child.'));
		});
	});
	
	/**
	 * http://ns.inria.fr/sparql-template/#statement2
	 */
	it('6.2 Recursion', () => {
		let fac = 'http://example.org/ns/fac';
		let six = {
			type: 'literal',
			value: '6',
			datatype: 'http://www.w3.org/2001/XMLSchema#integer'
		};
		
		setup('statement2');
		return sttl.callTemplate(fac, six).then(str => {
			assert.strictEqual(str, '6.5.4.3.2.1.0');
		});
	});
	
	/**
	 * http://ns.inria.fr/sparql-template/#statement6
	 */
	it('6.6 Format', () => {
		setup('statement6');
		return sttl.applyTemplates().then(str => {
			assert.strictEqual(str, '<h1>Alice</h1><p>Personal website</p>');
		});
	});
});

describe('Built-in operations', () => {
	it('should evaluate str() in template', () => {
		setup('operation');
		return sttl.applyTemplates().then(str => {
			// regex: single absolute URI
			assert.ok(str.match(/^(([^:\/?#]+):)(\/\/([^\/?#]*))([^?#]*)(\?([^#]*))?(#(.*))?/));
		});
	})
});