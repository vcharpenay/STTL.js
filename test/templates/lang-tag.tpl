prefix st:   <http://ns.inria.fr/sparql-template/>
prefix foaf: <http://xmlns.com/foaf/0.1/>
prefix ex:   <http://example.org/ns/>

template {
    format { "Pardon my French, %s." ?name }
} where {
    ?person foaf:name ?name
    filter (isLiteral(?name) && langMatches(lang(?name), "fr"))
}