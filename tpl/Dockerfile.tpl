FROM <%= baseImage %>

ENV IMPL_DIR /impl
ENV NPM_VERSION 3
ENV PM2_VERSION 1

ENV PM2_WEBSHELL_PORT 4000
ENV PM2_WEBSHELL_USERNAME root
ENV PM2_WEBSHELL_PASSWORD root

#ENV FOREVER_ROOT $IMPL_DIR/.forever
#ENV FOREVER_VERSION 0.15.1

<% if (baseRun) { %>RUN <%= baseRun %> <% } %>

RUN npm install npm@$NPM_VERSION -g
RUN npm install pm2@$PM2_VERSION -g

#RUN npm install forever@$FOREVER_VERSION -g

ADD . $IMPL_DIR/
WORKDIR $IMPL_DIR
RUN npm run prepare-runtime

EXPOSE $PM2_WEBSHELL_PORT

<% _.forEach(ports, function(port) { %>
EXPOSE <%= port %>
<% }); %>

#CMD npm start
#CMD forever -a -c "npm start" -l forever.log -o out.log -e err.log $IMPL_DIR

CMD pm2 install pm2-webshell && \
    pm2 set pm2-webshell:port $PM2_WEBSHELL_PORT && \
    pm2 set pm2-webshell:username $PM2_WEBSHELL_USERNAME && \
    pm2 set pm2-webshell:password $PM2_WEBSHELL_PASSWORD && \
    \
    pm2 start npm --no-daemon --name "api" -- run start
