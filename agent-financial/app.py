import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes import router


logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="API do Assistente Financeiro",
    description=(
        "API em português do Brasil. O chat também responde em inglês quando "
        "a mensagem do usuário estiver nesse idioma."
    ),
)


def _cors_allowed_origins() -> list[str]:
    configured_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
    return [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
