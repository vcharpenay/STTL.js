prefix st:   <http://ns.inria.fr/sparql-template/>
prefix foaf: <http://xmlns.com/foaf/0.1/>
prefix ex:   <http://example.org/ns/>

template {
    st:call-template(ex:display, ?in)
}
where {
    ?in a foaf:Person
}