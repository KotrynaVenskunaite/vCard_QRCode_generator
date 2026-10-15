#Use node v22 as base image
FROM node:22

WORKDIR /app

#copy package
COPY package*.json ./

#install dependancies
RUN npm install

#copy app into container
COPY . .

#port environment var
ENV PORT=3000
#expose the port
EXPOSE 3000

#run
CMD ["npm", "start"]