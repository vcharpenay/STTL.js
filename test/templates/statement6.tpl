prefix st:   <http://ns.inria.fr/sparql-template/>
prefix ex:   <http://example.org/ns/>

template {
  format {
    "<h1>%s</h1><p>%s</p>"
    ?title ?text
  }
  format {
    <file://./test/templates/statement6.txt>
    ?title ?text
  }
}
where {
  ?in ex:title ?title ; ex:text ?text
}