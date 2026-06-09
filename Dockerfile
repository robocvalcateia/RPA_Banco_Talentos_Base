FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

RUN if [ -f legacy_banco_talentos/requirements.txt ]; then \
    pip3 install --break-system-packages -r legacy_banco_talentos/requirements.txt; \
    fi

ENV NODE_ENV=production
ENV PYTHON_EXECUTABLE=python3

EXPOSE 3000

CMD ["npm","start"]