FROM python:3.11-slim

WORKDIR /app

COPY services/baggage_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/baggage_service/main.py ./main.py
COPY services/baggage_service/database.py ./database.py
COPY services/shared_observability.py ./shared_observability.py

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
