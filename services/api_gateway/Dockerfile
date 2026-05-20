FROM python:3.9-slim

WORKDIR /app

COPY services/api_gateway/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/api_gateway/main.py ./main.py
COPY services/shared_observability.py ./shared_observability.py

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
