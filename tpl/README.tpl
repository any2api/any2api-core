# <%= title %>

<%= description %>



## Run

There are three options to run <%= title %>:



### A. Run directly

You need to have Node.js installed to run:

    npm run prepare-runtime
    npm start



### B. Run in Docker container

You need to have Docker installed to run:

    docker build -t <%= name %> .
    docker run -d <% _.forEach(ports, function(port) { %>-p <%= port %>:<%= port %> <% }); %><%= name %>



### C. Run using Vagrant

You need to have Vagrant installed to run:

    vagrant up



## Access

Use the following endpoint(s) to access the API:

<% _.forEach(ports, function(port) { %>    http://{HOST}:<%= port %>
<% }); %>
If you run the API implementation locally, `{HOST}` is most probably `localhost`.
