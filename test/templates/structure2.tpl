{
	"type": "query",
	"prefixes": {},
	"queryType": "TEMPLATE",
	"name": "",
	"parameters": [],
	"expressions": [
		{ "type": "variable", "value": "in" },
		{ "type": "literal", "value": " " },
		{ "type": "variable", "value": "p" },
		{ "type": "literal", "value": " " },
		{ "type": "variable", "value": "o" },
		{ "type": "literal", "value": " ." }
	],
	"where": [
		{
			"type": "bgp",
			"triples": [
				{
					"subject": "?in",
					"predicate": "?p",
					"object": "?o"
				}
			]
		},
		{
			"type": "filter",
			"expression": {
				"type": "operation",
				"operator": "&&",
				"args": [
					{
						"type": "operation",
						"operator": "isiri",
						"args": ["?in"]
					},
					{
						"type": "operation",
						"operator": "isiri",
						"args": ["?o"]
					}
				]
			}
		}
	]
}