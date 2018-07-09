prefix owl:  <http://www.w3.org/2002/07/owl#>
prefix st:   <http://ns.inria.fr/sparql-template/>
prefix foaf: <http://xmlns.com/foaf/0.1/>

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