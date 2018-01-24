FROM node:7.4.0

ADD . /usr/src/app

WORKDIR /usr/src/app

RUN npm install
RUN npm install -g http-server
RUN npm run build

CMD ["http-server", "-p", "9999"]
