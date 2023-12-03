FROM node:19.9.0-alpine

WORKDIR /home/node
COPY package*.json ./
RUN npm ci --omit=dev
COPY src src

EXPOSE 8080
CMD [ "node", "." ]