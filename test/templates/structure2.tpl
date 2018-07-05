template {
  ?in " " ?p " " ?o " ."
}
where {
  ?in ?p ?o
  filter (isURI(?in) && isURI(?o))
}