{
	"type": "query",
	"prefixes": {
		"ex": "http://example.org/ns/"
	},
	"queryType": "TEMPLATE",
	"name": "http://example.org/ns/display",
	"parameters": ["?x"],
	"expressions": [
		{
			"type": "operation",
			"operator": "http://ns.inria.fr/sparql-template/apply-templates",
			"args": [
				{ "type": "variable", "value": "y" }
			]
		}
	],
	"where": [
		{
			"type": "bgp",
			"triples": [
				{
					"subject": "?x",
					"predicate": "http://xmlns.com/foaf/0.1/knows",
					"object": "?y"
				}
			]
		}
	]
}