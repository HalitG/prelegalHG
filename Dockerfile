# syntax=docker/dockerfile:1

# Build the frontend into static files.
FROM node:24-bookworm-slim AS frontend
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
# The build reads the agreements from ../templates, ../documents.json and ../catalog.json.
COPY templates/ /build/templates/
COPY documents.json catalog.json /build/
RUN npm run build

# Run the backend, which serves the API and the static frontend.
FROM python:3.14-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.11.33 /uv /usr/local/bin/uv
ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev
COPY backend/app ./app
# The AI chat reads the agreements' fields from these (see app/documents.py).
COPY documents.json catalog.json ./
COPY --from=frontend /build/frontend/out ./static
RUN useradd --system --uid 10001 --no-create-home prelegal && mkdir data && chown prelegal data
ENV PATH="/app/.venv/bin:$PATH" \
    PRELEGAL_STATIC_DIR=/app/static \
    PRELEGAL_DOCUMENTS_DIR=/app \
    PRELEGAL_DB_PATH=/app/data/prelegal.db
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --start-interval=1s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"]
# A single worker: each worker would reset the database when it starts.
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
