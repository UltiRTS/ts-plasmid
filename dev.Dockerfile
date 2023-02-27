FROM node:18
WORKDIR /plasmid
COPY package*.json /plasmid
RUN npm ci
CMD ["npm run dev"]