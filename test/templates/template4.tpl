prefix foaf: <http://xmlns.com/foaf/0.1/>
template {
  ?name ; separator = ", "
} where {
  ?in foaf:name ?name
}