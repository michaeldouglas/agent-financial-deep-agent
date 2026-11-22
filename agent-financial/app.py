from contextlib import asynccontextmanager
import logging
import os
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.agent import configure_mcp_tools
from src.agent_core.mcp import discover_financial_mcp_tools
from src.routes import router


logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Discover MCP tools once before serving agent requests."""
    try:
        configure_mcp_tools(await discover_financial_mcp_tools())
    except Exception:
        logging.getLogger("src.agent").exception(
            "Could not discover MCP tools; the agent will run without them."
        )
        configure_mcp_tools([])
    yield


app = FastAPI(
    title="API do Assistente Financeiro",
    description=(
        "API em português do Brasil. O chat também responde em inglês quando "
        "a mensagem do usuário estiver nesse idioma."
    ),
    lifespan=lifespan,
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
