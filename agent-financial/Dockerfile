FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN mkdir -p /workspace
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /uvx /bin/
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app.py ./
COPY src ./src
COPY skills ./skills

EXPOSE 8000
CMD ["uv", "run", "--locked", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
