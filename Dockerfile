FROM node:20-slim
WORKDIR /app
COPY package.json dev-server.js ./
COPY index.html 404.html robots.txt ./
COPY css/ css/
COPY js/ js/
COPY sample-data/ sample-data/
COPY data/ data/
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dev-server.js"]
