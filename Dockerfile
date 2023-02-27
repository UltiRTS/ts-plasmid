FROM node:18
WORKDIR /plasmid
COPY package*.json /plasmid/
COPY dist/ /plasmid/
RUN npm ci --only=production 
EXPOSE 5000
CMD ["node", "main.js"]