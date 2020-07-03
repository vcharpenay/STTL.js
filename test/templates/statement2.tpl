prefix st:   <http://ns.inria.fr/sparql-template/>
prefix ex:   <http://example.org/ns/>

template ex:fac(?n) {
   if (?n = 0, 0, 
     concat(str(?n), ".", st:call-template(ex:fac, ?n - 1)))
}
where {}