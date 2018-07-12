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
		let m = 'No suitable SPARQL configuration found';
		return Promise.reject(new Error(m));
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

function literal(str) {
	return {
		type: 'literal',
		value: str
	};
}

/**
 * from SPARQL JSON format to plain string
 * note: looks like Turtle but not exactly...
 */
function plain(term) {
	if (!term) return '';
	
	switch (term.type) {
		case 'literal':
			return '"' + term.value + '"'
				+ (term.lang ? '@' + term.lang : '')
				+ (term.datatype ? '^^' + term.datatype : '');
		case 'bnode':
			return '_:' + term.value;
		case 'uri':
			return term.value;
		default:
			return '';
	}
}

/**
 * inverse transformation of plain()
 */
function term(plain) {
	if (!plain || typeof plain != 'string') return '';
	
	let capture = null;
	if (capture = plain.match(/"(.*)"(@.*)?(\^\^(.*))?/)) {
		let [str, lit, lang, suffix, datatype] = capture;
		return {
			type: 'literal',
			value: lit,
			lang: lang,
			datatype: datatype
		}
	} else if (capture = plain.match(/([^_]*):(.*)/)) {
		let [str, prefix, name] = capture; 
		return {
			type: 'uri',
			value: prefixes[prefix] + name
		};
	} else if (plain.match(/_:.*/)) {
		return {
			type: 'bnode',
			value: plain.substring(2)
		}
	} else {
		return {
			type: 'uri',
			value: plain
		};
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
			// TODO numeric values (no quote)
			return '"' + term.value + '"'
				+ (term.lang ? '@' + term.lang : '')
				+ (term.datatype ? '^^' + turtle(term.datatype) : '');
		default:
			return '';
	}
}

function process(term) {
	return turtle(term);
}

/**
 * Returns a term (SPARQL JSON format)
 */
function evaluateExpression(exp, binding) {
	switch (expressionType(exp)) {
		case 'functionCall':
			switch (exp.function) {
				// TODO write generic callFunction() with function map
				case 'http://ns.inria.fr/sparql-template/apply-templates':
					let [arg] = exp.args;
					return evaluateExpression(arg, binding)
						.then(t => applyTemplates(t))
						.then(str => literal(str));
				case 'http://ns.inria.fr/sparql-template/call-template':
					let [uri, ...params] = exp.args;
					let evaluatedParams = params.map(p => evaluateExpression(p, binding));
					return Promise.all(evaluatedParams)
						.then(terms => callTemplate(uri, ...terms))
						.then(str => literal(str));
				case 'http://ns.inria.fr/sparql-template/concat':
					let evaluatedArgs = exp.args.map(arg => evaluateExpression(arg, binding));
					return Promise.all(evaluatedArgs).then(terms => {
						let values = terms.map(t => t.value);
						return literal(values.join(''));
					});
				case 'http://ns.inria.fr/sparql-template/process':
					let [variable] = exp.args;
					return evaluateExpression(variable, binding)
						.then(t => process(t))
						.then(str => literal(str));
				default:
					let m = 'Function <' + exp.function + '> undefined';
					return Promise.reject(new Error(m));
			}
		case 'operation':
			if (exp.operator === 'if') {
				let [condition, first, second] = exp.args;
				// TODO fix recursion
				return evaluateExpression(condition, binding).then(t => {
					let bool = t.datatype === 'http://www.w3.org/2001/XMLSchema#boolean'
						&& t.value === 'true';
					return evaluateExpression(bool ? first : second, binding);
				});
			} else {
				let evaluated = exp.args.map(arg => evaluateExpression(arg, binding));
				return Promise.all(evaluated).then(args => {
					let jq = {
						type: 'query',
						queryType: 'SELECT',
						variables: ['?exp'],
						where: [{
							type: 'bind',
							variable: '?exp',
							expression: {
								type: 'operation',
								operator: exp.operator,
								args: args.map(plain)
							}
						}]
					};
					
					let q = generator.stringify(jq);
					
					return sparql(q).then(resp => {
						let b = resp.results.bindings;
						return b[0].exp;
					});
				});
			}
		case 'format':
			switch (expressionType(exp.pattern)) {
				case 'literal':
					let evaluated = exp.args.map(arg => evaluateExpression(arg, binding));
					return Promise.all(evaluated).then(args => {
						let pattern = term(exp.pattern);
						return {
							type: 'literal',
							// TODO error if arg not literal
							value: args.reduce((v, arg) => v.replace('%s', arg.value), pattern.value)
						}
					});
				case 'uri':
					let m = 'Dereferencing IRI in FORMAT pattern is not supported';
					return Promise.reject(new Error(m));
				default:
					return Promise.resolve({});
			}
		case 'literal':
			return Promise.resolve(term(exp));
		case 'variable':
			let t = binding[exp.substring(1)];
			return Promise.resolve(t);
		default:
			return Promise.resolve({});
	}
}

function variables(exp) {
	switch (expressionType(exp)) {
		case 'functionCall':
		case 'operation':
		case 'format':
			return exp.args.reduce((v, arg) => v.concat(variables(arg)), []);
		case 'variable':
			return [exp];
		default:
			return [];
	}
}

/**
 * Returns a plain string (always a literal)
 */
function applyTemplate(tpl, binding) {
	if (!tpl || tpl.queryType != 'TEMPLATE') {
		let m = 'Input argument is not a SPARQL template';
		return Promise.reject(new Error(m));
	}
	
	let patterns = [];
	if (binding) {
		patterns = Object.entries(binding)
			.filter(([v, t]) => t.type === 'uri' || t.type === 'literal')
			.map(([v, t]) => ({
				type: 'bind',
				variable: '?' + v,
				expression: plain(t)
			}));
	}
	
	let jsonQuery = {
		type: 'query',
		queryType: 'SELECT',
		prefixes: tpl.prefixes,
		variables: variables(tpl.expression),
		where: patterns.concat(tpl.where)
	}
	
	let query = generator.stringify(jsonQuery);
	
	return sparql(query).then(resp => {
		let bindings = resp.results.bindings;
		// TODO if no binding but all template variables bound, then evaluate
		let group = bindings.map(b => evaluateExpression(tpl.expression, b));
		
		let sep = tpl.separator || '\n';
		return Promise.all(group).then(g => g.map(t => t.value).join(sep));
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
	let tpl = directory.find(tpl => tpl.name === uri);
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
