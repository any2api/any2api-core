FROM <%= baseImage %>

ENV IMPL_DIR /impl
ENV FOREVER_ROOT $IMPL_DIR/.forever
ENV FOREVER_VERSION 0.15.1

<% if (baseRun) { %>RUN <%= baseRun %> <% } %>

RUN npm install forever@$FOREVER_VERSION -g

ADD . $IMPL_DIR/
WORKDIR $IMPL_DIR
RUN npm run prepare-runtime

<% _.forEach(ports, function(port) { %>
EXPOSE <%= port %>
<% }); %>

#CMD npm start
CMD forever -a -c "npm start" -l forever.log -o out.log -e err.log $IMPL_DIR
