FROM node:lts AS builder
WORKDIR /app

# build/install dependencies
COPY package*.json ./
ENV NODE_ENV production
RUN npm install

# configure groom runtime details
EXPOSE 10666/udp
USER node
CMD ["node", "udp/publisher.js"]

# copy source tree
COPY . .
