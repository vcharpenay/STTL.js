prefix st:   <http://ns.inria.fr/sparql-template/>
prefix foaf: <http://xmlns.com/foaf/0.1/>
prefix ex:   <http://example.org/ns/>

template ex:display(?x) {
    st:apply-templates(?y)
}
where {
    ?x foaf:knows ?y
}