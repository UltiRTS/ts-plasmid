FROM node:18-alpine as build
WORKDIR /plasmid
COPY . /plasmid/
RUN npm i
RUN npm run build

FROM node:18-alpine
WORKDIR /plasmid
RUN apk update --no-cache && apk add bash openjdk11-jre-headless
COPY package*.json /plasmid/
COPY --from=build /plasmid/dist /plasmid/dist
COPY db/liquibase/ /plasmid/db/liquibase/
RUN npm i --omit=dev
EXPOSE 5000 8081
CMD ["node", "dist/main.js"]
