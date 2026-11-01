FROM python:3.13-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libreoffice-writer poppler-utils fonts-liberation && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pdf2image==1.17.0
WORKDIR /work
