"""Environment-backed configuration for the financial assistant."""

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.language_models.chat_models import BaseChatModel

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SKILLS_ROOT = PROJECT_ROOT / "skills"
SKILLS_SOURCE = "/skills/"
MCP_FINANCIAL_URL = os.getenv(
    "MCP_FINANCIAL_URL",
    "http://mcp-financial:8081/mcp",
)

SYSTEM_PROMPT = """Você é um assistente financeiro informativo.
Explique conceitos com clareza, mostre cálculos quando úteis e peça contexto
quando a pergunta não trouxer dados suficientes. Não invente dados de mercado
nem apresente uma resposta como garantia de retorno.
Use português do Brasil por padrão. Responda no idioma usado pelo usuário;
quando a mensagem estiver em inglês, responda em inglês. Se o usuário misturar
idiomas, use o idioma predominante.
Seja conciso por padrão; aprofunde quando o usuário pedir ou quando o cálculo exigir."""


def create_chat_model() -> BaseChatModel:
    """Build the configured OpenAI chat model lazily."""
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-6-luna"),
        reasoning_effort=os.getenv("OPENAI_REASONING_EFFORT", "low"),
    )
