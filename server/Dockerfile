# Use official Node image
FROM node:18-lpine

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy rest of the code
COPY . .

RUN mkdir -p logs

# Expose port
EXPOSE 5000

# Start the app
CMD ["node", "src/server.js"]