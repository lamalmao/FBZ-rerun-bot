FROM node:18
WORKDIR /usr/src/bot
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 80
EXPOSE 443
EXPOSE 5222

CMD [ "node", "build/app.js" ]