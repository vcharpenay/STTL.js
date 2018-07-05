prefix owl:  <http://www.w3.org/2002/07/owl#>
prefix st:   <http://ns.inria.fr/sparql-template/>

template {
  "allValuesFrom(" 
      st:apply-templates(?p) " " 
      st:apply-templates(?c) 
  ")"
}
where {
   ?in a owl:Restriction ;
      owl:onProperty ?p ;
      owl:allValuesFrom ?c .
}