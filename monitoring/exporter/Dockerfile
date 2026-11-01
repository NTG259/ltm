FROM python:3.13-slim
RUN pip install --no-cache-dir psycopg[binary]==3.2.12
COPY exporter.py /app/exporter.py
CMD ["python", "/app/exporter.py"]
