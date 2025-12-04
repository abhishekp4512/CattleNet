# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt ./backend/

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the entire backend folder
COPY backend ./backend

# Copy ML model file
COPY backend/cattle_health_model.joblib ./backend/

# Set working directory to backend
WORKDIR /app/backend

# Start the application
CMD ["python", "app.py"]
