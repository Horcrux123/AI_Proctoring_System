# Use a base image that has Node.js
FROM node:20-bullseye

# Install Python and Java
RUN apt-get update && \
    apt-get install -y python3 default-jdk && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    apt-get clean

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only backend dependencies
# Since package.json has frontend scripts too, we just install standard dependencies
RUN npm install

# Copy the rest of the backend files
# We will copy the root files and the backend folder
COPY backend/ backend/
COPY package.json package.json

# Expose the port
EXPOSE 5000

# Start the server
CMD ["node", "backend/server.js"]
