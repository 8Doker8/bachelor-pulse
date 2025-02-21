# web/Dockerfile (development mode)
FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your app code
COPY . .

# Expose the port (Next.js dev server usually runs on 3000)
EXPOSE 3000

# Start the dev server
CMD ["npm", "run", "dev"]