# Servicio de IA: FastAPI + el modelo entrenado.
# Los modelos NO se copian a la imagen: llegan por el volumen /models
# (ver docker-compose.yml), así reentrenar no obliga a reconstruir.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_DIR=/models

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY modelo.py main.py ./

# Usuario sin privilegios: el servicio no necesita ser root
RUN useradd --create-home --uid 1001 ia
USER ia

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
