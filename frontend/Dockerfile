# Frontend en dos etapas:
#   1. "compilar": Node instala dependencias y genera los archivos estáticos (dist/).
#   2. "servir":   Nginx sirve dist/ y reenvía /api/ al backend.
# La imagen final solo lleva Nginx y los archivos compilados (sin Node ni node_modules).

FROM node:22-alpine AS compilar
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS servir
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilar /app/dist /usr/share/nginx/html
EXPOSE 80
