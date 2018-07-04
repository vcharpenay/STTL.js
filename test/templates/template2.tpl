{
	"type": "query",
	"prefixes": {
		"foaf": "http://xmlns.com/foaf/0.1/"
	},
	"queryType": "TEMPLATE",
	"name": "",
	"parameters": [],
	"expressions": [
		{
			"type": "literal",
			"value": "allValuesFrom("
		},
		{
			"type": "operation",
			"operator": "http://ns.inria.fr/sparql-template/apply-templates",
			"args": [
				{ "type": "variable", "value": "p" }
			]
		},
		{
			"type": "literal",
			"value": " "
		},
		{
			"type": "operation",
			"operator": "http://ns.inria.fr/sparql-template/apply-templates",
			"args": [
				{ "type": "variable", "value": "c" }
			]
		},
		{
			"type": "literal",
			"value": ")"
		}
	],
	"where": [
		{
			"type": "bgp",
			"triples": [
				{
					"subject": "?in",
					"predicate": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
					"object": "http://www.w3.org/2002/07/owl#Restriction"
				},
				{
					"subject": "?in",
					"predicate": "http://www.w3.org/2002/07/owl#onProperty",
					"object": "?p"
				},
				{
					"subject": "?in",
					"predicate": "http://www.w3.org/2002/07/owl#allValuesFrom",
					"object": "?c"
				}
			]
		}
	]
}