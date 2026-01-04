FROM apify/actor-node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --omit=dev --omit=optional \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/tmp/*

COPY . ./

CMD ["npm", "start"]
