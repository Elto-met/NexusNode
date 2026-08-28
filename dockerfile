FROM node:24-alpine
WORKDIR server
COPY . .
CMD ["node", "server/server.mjs"]
