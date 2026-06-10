FROM node:20-bookworm

WORKDIR /app

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV PYTHONUTF8=1
ENV PYTHONIOENCODING=utf-8
ENV NODE_ENV=production
ENV PYTHON_EXECUTABLE=python3

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      libreoffice \
      libreoffice-writer \
      poppler-utils \
      fonts-dejavu \
      fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

RUN if [ -f legacy_banco_talentos/requirements.txt ]; then \
    pip3 install --break-system-packages --no-cache-dir -r legacy_banco_talentos/requirements.txt; \
    fi

EXPOSE 3000

CMD ["npm", "start"]