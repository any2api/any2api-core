FROM <%= baseImage %>

ENV API_DIR /api

ENV NPM_VERSION 3

ENV PM2_VERSION 1
ENV PM2_HOME $API_DIR/.pm2

ENV PM2_WEBSHELL_PORT 4000
ENV PM2_WEBSHELL_USERNAME root
ENV PM2_WEBSHELL_PASSWORD root

#ENV FOREVER_ROOT $API_DIR/.forever
#ENV FOREVER_VERSION 0.15.1

<% if (baseRun) { %>RUN <%= baseRun %> <% } %>

ADD . $API_DIR/
WORKDIR $API_DIR

RUN npm install npm@$NPM_VERSION -g

RUN npm install pm2@$PM2_VERSION -g && \
    pm2 install pm2-webshell

#RUN npm install forever@$FOREVER_VERSION -g

RUN npm run prepare-runtime

#EXPOSE $PM2_WEBSHELL_PORT

<% _.forEach(ports, function(port) { %>
EXPOSE <%= port %>
<% }); %>

#CMD npm start
#CMD forever -a -c "npm start" -l forever.log -o out.log -e err.log $API_DIR

CMD pm2 set pm2-webshell:port $PM2_WEBSHELL_PORT && \
    pm2 set pm2-webshell:username $PM2_WEBSHELL_USERNAME && \
    pm2 set pm2-webshell:password $PM2_WEBSHELL_PASSWORD && \
    \
    pm2 start npm --no-daemon --name "api" -- run start
