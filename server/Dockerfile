# Use official Node image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies (including devDependencies for tsx)
RUN npm install

# Copy rest of the code
COPY . .

RUN mkdir -p logs

# Expose port
EXPOSE 5000

# Start the app with TypeScript support  
CMD ["npx", "tsx", "src/server.ts"]