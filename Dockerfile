# Use an official Node.js runtime as the base image
FROM node:24-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage caching
COPY package.json ./

# Explicitly install your dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose port 3000 for your server
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
