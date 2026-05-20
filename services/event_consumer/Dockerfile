FROM python:3.9-slim

WORKDIR /app

COPY services/event_consumer/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/event_consumer/consumer.py ./consumer.py

CMD ["python", "consumer.py"]
