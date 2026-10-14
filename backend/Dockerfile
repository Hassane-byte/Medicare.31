# --- Build Stage ---
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# --- Run Stage ---
FROM python:3.11-slim

WORKDIR /app

# Copy only installed packages from builder
COPY --from=builder /root/.local /root/.local
COPY . .

# Update PATH to include user-installed binaries
ENV PATH=/root/.local/bin:$PATH

# Security: Run as non-root user
RUN useradd -m appuser
USER appuser

# Production Command: Remove --reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
