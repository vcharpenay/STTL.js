template {
	str(?s)
} where {
	?s ?p ?o
	filter (isIRI(?s))
} limit 1