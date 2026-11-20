# API principal (Node.js + Express). Puerto interno 4000, no se publica:
# el navegador llega a ella a través del Nginx del frontend (/api/).
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Primero las dependencias: esta capa se reutiliza si package.json no cambia
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src

# La imagen de Node ya trae el usuario "node" sin privilegios
USER node

EXPOSE 4000
CMD ["node", "src/index.js"]
