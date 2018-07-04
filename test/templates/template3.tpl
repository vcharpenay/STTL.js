{
	"type": "query",
	"prefixes": {
		"foaf": "http://xmlns.com/foaf/0.1/",
		"ex": "http://example.org/ns/"
	},
	"queryType": "TEMPLATE",
	"name": "",
	"parameters": [],
	"expressions": [
		{
			"type": "operation",
			"operator": "http://ns.inria.fr/sparql-template/call-template",
			"args": [
				{ "type": "uri", "value": "http://example.org/ns/display" },
				{ "type": "variable", "value": "in" }
			]
		}
	],
	"where": [
		{
			"type": "bgp",
			"triples": [
				{
					"subject": "?in",
					"predicate": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
					"object": "http://xmlns.com/foaf/0.1/Person"
				}
			]
		}
	]
}