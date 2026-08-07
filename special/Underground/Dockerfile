FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

RUN npm install && npm install --prefix server && npm install --prefix client

COPY server server
COPY client client

RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "server/index.js"]
