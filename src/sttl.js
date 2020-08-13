const fs = require('fs');
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
		if (exp.match(/"[^]*"/)) return 'literal';
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
	if (capture = plain.match(/"([^]*)"(@(.*))?(\^\^(.*))?/)) {
		let [str, lit, at, lang, roof, datatype] = capture;
		return {
			type: 'literal',
			value: lit,
			lang: lang,
			datatype: datatype
		}
	} else if (plain.match(/^(([^:\/?#]+):)(\/\/([^\/?#]*))([^?#]*)(\?([^#]*))?(#(.*))?/)) {
		return {
			type: 'uri',
			value: plain
		};
	} else if (capture = plain.match(/(\w*):(.*)/)) {
		let [str, prefix, name] = capture; 
		return {
			type: 'uri',
			value: prefixes[prefix] + name
		};
	} else if (plain.match(/_:(.*)/)) {
		let [str, name] = capture; 
		return {
			type: 'bnode',
			value: name
		}
	} else {
		return {};
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
 * Function map for the st: namespace 
 */
const functions = {
	'http://ns.inria.fr/sparql-template/apply-templates': applyTemplates,
	'http://ns.inria.fr/sparql-template/call-template': (t, ...args) => callTemplate(t.value, ...args),
	'http://ns.inria.fr/sparql-template/concat': (...args) => args.map(t => t.value).join(''),
	'http://ns.inria.fr/sparql-template/process': turtle
}

/**
 * Calls JS function with provided arguments
 */
function evaluateFunctionCall(exp, binding) {
	let uri = exp.function;
	let fn = functions[uri];

	if (!fn) {
		let m = 'Function <' + uri + '> undefined';
		return Promise.reject(new Error(m));
	}
	
	let evaluated = exp.args.map(arg => evaluateExpression(arg, binding));
	return Promise.all(evaluated)
		.then(terms => fn(...terms))
		.then(str => literal(str));
}

/**
 * Delegates evaluation to SPARQL endpoint
 */
function evaluateOperation(exp, binding) {
	if (exp.operator === 'if') {
		let [condition, first, second] = exp.args;
		
		return evaluateExpression(condition, binding).then(t => {
			let bool =
				t.datatype === 'http://www.w3.org/2001/XMLSchema#boolean'
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
}

function evaluateFormat(exp, binding) {
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
			let pattern = term(exp.pattern);
			if (pattern.value.startsWith('file://')) {
				if (fs) {
					let f = pattern.value.replace('file://', '');
					// TODO open stream instead
					let lit = fs.readFileSync(f, 'utf-8');

					exp = {
						pattern: '"' + lit + '"',
						args: exp.args
					};

					return evaluateFormat(exp, binding);
				}
			}
			let m = 'Dereferencing IRI in FORMAT pattern is not supported';
			return Promise.reject(new Error(m));
		default:
			return Promise.resolve({});
	}
}

/**
 * Returns a term (SPARQL JSON format)
 */
function evaluateExpression(exp, binding) {
	switch (expressionType(exp)) {
		case 'functionCall':
			return evaluateFunctionCall(exp, binding);
		case 'operation':
			return evaluateOperation(exp, binding);
		case 'format':
			return evaluateFormat(exp, binding);
		case 'literal':
		case 'uri':
		case 'bnode':
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
    
    let vars = variables(tpl.expression);
    // TODO instead, directly evaluate expression (see TODO below)
    if (vars.length === 0) vars.push('*');
	
	let jsonQuery = {
		type: 'query',
		queryType: 'SELECT',
		prefixes: tpl.prefixes,
		variables: vars,
		where: patterns.concat(tpl.where),
		distinct: true
	}

	// TODO DISTINCT modifier by default?
	let modifiers = ['order', 'offset', 'limit'];
	modifiers.forEach(modifier => {
		let def = tpl[modifier];
		if (def) jsonQuery[modifier] = def;
	});
	
	let query = generator.stringify(jsonQuery);
	
	return sparql(query).then(resp => {
		let bindings = resp.results.bindings;
		// TODO if no binding but all template variables bound, then evaluate
		let group = bindings.map(b => evaluateExpression(tpl.expression, b));
		
		let sep = tpl.separator ? term(tpl.separator).value : '\n';
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
		if (!tpl) throw new Error('Template(s) cannot be parsed: ' + str);
		directory = directory.concat(tpl);
		for (p in tpl.prefixes) prefixes[p] = tpl.prefixes[p];
	},
	clear: () => {
		directory = [];
		prefixes = {};
	}
};
