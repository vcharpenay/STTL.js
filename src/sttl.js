const generator = new require('sparqljs').Generator();
const fetch = require('node-fetch');

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

function bind(exp, binding) {
	switch (exp.type) {
		case 'operation':
			return {
				type: 'operation',
				operator: exp.operator,
				args: exp.args.map(arg => bind(arg, binding))
			};
		case 'variable':
			return binding[exp.value];
		case 'literal':
			// should evaluate as-is
			exp.ground = true;
		default:
			return exp;
	}
}

function evaluateExpression(exp) {
	switch (exp.type) {
		case 'operation':
			switch (exp.operator) {
				case 'http://ns.inria.fr/sparql-template/apply-templates':
					let t = exp.args[0];
					return applyTemplates(t);
				case 'http://ns.inria.fr/sparql-template/call-template':
					return callTemplate(); // FIXME
				default:
					let m = 'Function <' + exp.operator + '> undefined';
					return Promise.reject(new Error(m));
			}
		case 'literal':
			if (exp.ground) return Promise.resolve(exp.value);
		case 'uri':
		case 'bnode':
			return Promise.resolve(process(exp));
		default:
			return Promise.resolve('');
	}
}

function variables(exp) {
	switch (exp.type) {
		case 'operation':
			return exp.args.reduce((v, arg) => v.concat(variables(arg)), []);
		case 'variable':
			return ['?' + exp.value];
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
	return directory.map(tpl => applyTemplate(tpl, b)).join('');
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
	register: tpl => {
		directory.push(tpl);
		for (p in tpl.prefixes) prefixes[p] = tpl.prefixes[p];
	},
	clear: () => {
		directory = [];
		prefixes = {};
	}
};
