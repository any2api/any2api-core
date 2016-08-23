version: '2'
services:
  api:
    build: .
    ports:
    <% _.forEach(ports, function(port) { %>- '<%= port %>'<% }); %>
    environment:
      DEBUG: soap-api-impl
    network_mode: 'host'
    restart: always
