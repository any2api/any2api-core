FROM <%= baseImage %>

<% if (baseRun) { %>RUN <%= baseRun %> <% } %>

RUN npm install forever -g

ADD . /impl/
WORKDIR /impl
RUN npm run prepare-runtime

<% _.forEach(ports, function(port) { %>
EXPOSE <%= port %>
<% }); %>

#CMD npm start
CMD forever -c "npm start" -l ./forever.log -o ./out.log -e ./err.log .
