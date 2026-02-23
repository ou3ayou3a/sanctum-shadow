FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY server.js .
COPY site/ site/
EXPOSE 3000
CMD ["node", "server.js"]
