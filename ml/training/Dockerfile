# Imagen del job de entrenamiento.
# Se ejecuta bajo demanda:  docker compose run --rm training
FROM python:3.12-slim

# Sin archivos .pyc, salida inmediata en la terminal y matplotlib sin pantalla
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPLBACKEND=Agg \
    MPLCONFIGDIR=/tmp/matplotlib

WORKDIR /app

# Primero las librerías: Docker reutiliza esta capa si requirements.txt no cambia
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Después el código
COPY columnas.py preparar_datos.py train.py entrenar.sh ./
RUN chmod +x entrenar.sh

CMD ["./entrenar.sh"]
