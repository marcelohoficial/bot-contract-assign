# Usa a imagem do Node.js com Puppeteer
FROM ghcr.io/puppeteer/puppeteer:latest

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos para o container
COPY . .

# Instala as dependências
RUN npm install

# Expõe a porta para futuras melhorias (como um servidor API)
EXPOSE 3000

# Comando para rodar o script
CMD ["node", "index.js"]
