prefix st:   <http://ns.inria.fr/sparql-template/>
prefix foaf: <http://xmlns.com/foaf/0.1/>
prefix ex:   <http://example.org/ns/>

template {
	if (?age >= 18, 
		st:call-template(ex:adult, ?in),
		st:call-template(ex:child, ?in))
}
where {
	?in foaf:age ?age
}