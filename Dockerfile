FROM node:18-alpine as build
WORKDIR /plasmid
COPY . /plasmid/
RUN npm i
RUN npm run build

FROM node:18-alpine
WORKDIR /plasmid
COPY package*.json /plasmid/
COPY --from=build /plasmid/dist /plasmid/dist
RUN npm i --omit=dev
EXPOSE 5000 8081
CMD ["node", "dist/main.js"]
