FROM debian:11.6

ENV TZ=Europe/Moscow
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt-get -y update; apt-get -y install curl
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - &&\
  apt-get install -y nodejs
RUN apt-get install -y chromium
RUN apt-get install -y libx11-xcb1 libxcomposite1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 

WORKDIR /usr/src/bot

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 80
EXPOSE 8008
EXPOSE 443
EXPOSE 5222
EXPOSE 3000

CMD [ "npm", "start" ]