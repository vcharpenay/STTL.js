const sparqljs = require('sparqljs');
const fetch = require('node-fetch');

const parser = require('./parser.js');
const generator = new sparqljs.Generator();

function err(e) {
	console.error(e);
}

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

// collection of templates tested by applyTemplates()
let directory = [];

// merged prefixes from all templates
let prefixes = {};

function turtle(term) {
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
			return '"' + term.value + '"'; // TODO datatype, lang
		default:
			return term.value;
	}
}

function process(term) {
	return turtle(term);
}

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

function bind(exp, binding) {
	switch (expressionType(exp)) {
		case 'functionCall':
			return {
				type: 'functionCall',
				function: exp.function,
				args: exp.args.map(arg => bind(arg, binding))
			};
		case 'operation':
			return {
				type: 'operation',
				operator: exp.operator,
				args: exp.args.map(arg => bind(arg, binding))
			};
		case 'variable':
			return binding[exp.substring(1)];
		case 'literal':
			// should evaluate as-is
		default:
			return exp;
	}
}

function evaluateExpression(exp) {
	switch (expressionType(exp)) {
		case 'functionCall':
			switch (exp.function) {
				case 'http://ns.inria.fr/sparql-template/apply-templates':
					let t = exp.args[0];
					return applyTemplates(t);
				case 'http://ns.inria.fr/sparql-template/call-template':
					let [uri, ...params] = exp.args;
					return callTemplate(uri, ...params);
				default:
					let m = 'Function <' + exp.operator + '> undefined';
					return Promise.reject(new Error(m));
			}
		case 'literal':
			if (typeof exp === 'string') {
				// ground literal, part of template
				let val = exp.substring(1, exp.length - 1);
				return Promise.resolve(val);
			}
		case 'uri':
		case 'bnode':
			return Promise.resolve(process(exp));
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
		return '';
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
		for (v in binding) { values['?' + v] = binding[v].value }
		
		jsonQuery.where.unshift({
			type: 'values',
			values: [values]
		});
	}
	
	let query = generator.stringify(jsonQuery);
	
	return sparql(query).then(resp => {
		let bindings = resp.results.bindings;
		let group = bindings.map(b => {
			let evaluated = tpl.expressions.map(e => evaluateExpression(bind(e, b)));
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
	}).catch(err);
}

function applyTemplates(term) {
	// TODO detect loop in template selecion (pair <focus node, template>)
	let b = term ? { 'in': term } : null;
	
	let zeroParams = directory.filter(tpl => (tpl.parameters || []).length === 0);
	return zeroParams.reduce((application, tpl) => {
		return application.then(str => str || applyTemplate(tpl, b));
	}, Promise.resolve('')).then(str => {
		return str || turtle(term);
	}).catch(err);
}

function callTemplate(uri, ...terms) {
	let tpl = directory.find(tpl => tpl.name = uri);
	if (!tpl) return '';
	
	let b = tpl.parameters.reduce((b, p, i) => {
		b[p.substring(1)] = terms[i];
		return b;
	}, {});
	return applyTemplate(tpl, b).catch(err);
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
		directory.push(tpl);
		for (p in tpl.prefixes) prefixes[p] = tpl.prefixes[p];
	},
	clear: () => {
		directory = [];
		prefixes = {};
	}
};
