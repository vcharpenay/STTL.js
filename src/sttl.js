const sparqljs = require('sparqljs');
const fetch = require('node-fetch');

const parser = require('./parser.js');
const generator = new sparqljs.Generator();

// SPARQL configuration
let endpoint = 'http://localhost';
let fn = null;

function sparql(q) {
	if (fn) {
		let res = fn(q);
		return (res instanceof Promise) ? res : Promise.resolve(res);
	} else if (endpoint) {
		return fetch(endpoint, {
			body: q,
			method: 'POST',
			headers: {
				'content-type': 'application/sparql-query',
				'accept': 'application/sparql-results+json'
			}
		}).then(resp => resp.json());
	} else {
		return Promise.reject(new Error('No suitable SPARQL configuration found'));
	}
}

/**
 * collection of templates tested by applyTemplates()
 */
let directory = [];

/**
 * merged prefixes from all templates
 */
let prefixes = {};

function expressionType(exp) {
	if (typeof exp === 'string') {
		if (exp.startsWith('?')) return 'variable';
		if (exp.match(/".*"/)) return 'literal';
		if (exp.startsWith('_:')) return 'bnode';
		return 'uri';
	} else if (typeof exp === 'object' && exp.type) {
		return exp.type;
	} else {
		return '';
	}
}

/**
 * from SPARQL JSON format to plain string
 */
function plain(term) {
	if (!term) return '';
	
	switch (term.type) {
		case 'literal':
			return '"' + term.value + '"';
		case 'bnode':
			return '_:' + term.value;
		case 'uri':
			return term.value;
		default:
			return '';
	}
}

function turtle(term) {
	if (!term) return '';
	
	switch (term.type) {
		case 'uri':
			for (p in prefixes) {
				let uri = term.value;
				let ns = prefixes[p];
				if (uri.startsWith(ns)) {
					let name = uri.substring(ns.length);
					return p + ':' + name;
				}
			}
			return '<' + term.value + '>';
		case 'bnode':
			return '_:' + term.value;
		case 'literal':
			 // TODO datatype & lang
			return '"' + term.value + '"';
		default:
			return '';
	}
}

/**
 * see also turtle(), opposite function
 */
function term(ttl) {
	if (!ttl || typeof ttl != 'string') return '';
	
	if (ttl.match(/(".*")|(<.*>)/)) {
		let v = ttl.substring(1, ttl.length - 1);
		return {
			type: ttl[0] === '<' ? 'uri' : 'literal',
			value: v
		};
	} else if (ttl.match(/[^_]*:.*/)) {
		let [prefix, name] = ttl.split(':'); 
		return {
			type: 'uri',
			value: prefixes[prefix] + name
		};
	} else if (ttl.match(/_:.*/)) {
		return {
			type: 'bnode',
			value: ttl.substring(2)
		}
	} else {
		return {};
	}
}

function process(term) {
	return turtle(term);
}

function evaluateExpression(exp, binding) {
	switch (expressionType(exp)) {
		case 'functionCall':
			switch (exp.function) {
				case 'http://ns.inria.fr/sparql-template/apply-templates':
					let arg = exp.args[0];
					return evaluateExpression(arg, binding).then(str => {
						let t = term(str);
						return applyTemplates(t);
					});
				case 'http://ns.inria.fr/sparql-template/call-template':
					let [uri, ...params] = exp.args;
					let evaluated = params.map(p => evaluateExpression(p, binding));
					return Promise.all(evaluated).then(ttl => {
						let terms = ttl.map(term);
						return callTemplate(uri, ...terms);
					})
				default:
					let m = 'Function <' + exp.function + '> undefined';
					return Promise.reject(new Error(m));
			}
		case 'operation':
			// TODO embed in parent SPARQL query instead
			let evaluated = exp.args.map(arg => evaluateExpression(arg, binding));
			return Promise.all(evaluated).then(ttl => {
				let args = ttl.map(term).map(plain);
				let v = '?exp';
				tpl = {
					type: 'query',
					queryType: 'TEMPLATE',
					expressions: [v],
					where: [{
						type: 'bind',
						variable: v,
						expression: {
							type: 'operation',
							operator: exp.operator,
							args: args
						}
					}]
				};
				return applyTemplate(tpl);
			});
		case 'literal':
			let value = exp.substring(1, exp.length - 1);
			return Promise.resolve(value);
		case 'variable':
			let t = binding[exp.substring(1)];
			return Promise.resolve(process(t));
		default:
			return Promise.resolve('');
	}
}

function variables(exp) {
	switch (expressionType(exp)) {
		case 'functionCall':
		case 'operation':
			return exp.args.reduce((v, arg) => v.concat(variables(arg)), []);
		case 'variable':
			return [exp];
		default:
			return [];
	}
}

function applyTemplate(tpl, binding) {
	if (!tpl || tpl.queryType != 'TEMPLATE') {
		let m = 'Input argument is not a SPARQL template';
		return Promise.reject(new Error(m));
	}
	
	let jsonQuery = {
		type: 'query',
		queryType: 'SELECT',
		prefixes: tpl.prefixes,
		variables: tpl.expressions.reduce((v, e) => v.concat(variables(e)), []),
		where: tpl.where
	}
	
	if (binding) {
		let values = {};
		for (v in binding) values['?' + v] = plain(binding[v]);
		
		jsonQuery.where.unshift({
			type: 'values',
			values: [values]
		});
	}
	
	let query = generator.stringify(jsonQuery);
	
	return sparql(query).then(resp => {
		let bindings = resp.results.bindings;
		let group = bindings.map(b => {
			let evaluated = tpl.expressions.map(e => evaluateExpression(e, b));
			return Promise.all(evaluated).then(e => e.join(''));
		});
		
		let sep = tpl.separator || '\n';
		return Promise.all(group).then(g => g.join(sep));
	});
}

function applyTemplatesAll(term) {
	let b = term ? { 'in': term } : null;
	
	let zeroParams = directory.filter(tpl => (tpl.parameters || []).length === 0);
	return Promise.all(zeroParams.map(tpl => applyTemplate(tpl, b))).then(str => {
		return str.join('');
	});
}

function applyTemplates(term) {
	// TODO detect loop in template selecion (pair <focus node, template>)
	let b = term ? { 'in': term } : null;
	
	let zeroParams = directory.filter(tpl => (tpl.parameters || []).length === 0);
	return zeroParams.reduce((application, tpl) => {
		return application.then(str => str || applyTemplate(tpl, b));
	}, Promise.resolve('')).then(str => {
		return str || turtle(term);
	});
}

function callTemplate(uri, ...terms) {
	let tpl = directory.find(tpl => tpl.name = uri);
	if (!tpl) {
		let m = 'Template <' + uri + '> not found';
		return Promise.reject(new Error(m));
	};
	
	let b = tpl.parameters.reduce((b, p, i) => {
		b[p.substring(1)] = terms[i];
		return b;
	}, {});
	return applyTemplate(tpl, b);
}

module.exports = {
	// http://ns.inria.fr/sparql-template/apply-templates
	applyTemplates: applyTemplates,
	// http://ns.inria.fr/sparql-template/call-template
	callTemplate: callTemplate,
	
	// general configuration
	connect: arg => {
		if (typeof arg === 'string') endpoint = arg;
		else if (typeof arg === 'function') fn = arg;
	},
	register: str => {
		let tpl = parser.parse(str);
		if (!tpl) throw new Error('Template cannot be parsed: ' + str);
		directory.push(tpl);
		for (p in tpl.prefixes) prefixes[p] = tpl.prefixes[p];
	},
	clear: () => {
		directory = [];
		prefixes = {};
	}
};
