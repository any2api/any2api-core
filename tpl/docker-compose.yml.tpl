version: '2'
services:
  <%= serviceName %>:
    build: .
    ports:
    <% _.forEach(ports, function(port) { %>- "<%= port %>"<% }); %>
    environment:
      DEBUG: soap-api-impl
