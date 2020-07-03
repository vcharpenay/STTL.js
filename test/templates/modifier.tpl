prefix foaf: <http://xmlns.com/foaf/0.1/>
prefix ex: <http://example.org/ns/>
template {
	?name ; separator = ", "
} where { ?s a foaf:Person ; foaf:name ?name }
order by ?name
offset 1
limit 2