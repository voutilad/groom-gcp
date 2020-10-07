FROM node:lts AS builder
WORKDIR /app

# build/install dependencies
COPY package*.json ./
ENV NODE_ENV production
RUN npm install

# configure groom runtime details
EXPOSE 8000/tcp
USER node
CMD ["node", "ws/server.js"]

# copy source tree
COPY . .
