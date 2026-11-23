"""Environment-backed configuration for the financial assistant."""

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.language_models.chat_models import BaseChatModel

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SKILLS_ROOT = PROJECT_ROOT / "skills"
SKILLS_SOURCE = "/skills/"
MCP_PROVIDER = os.getenv("MCP_PROVIDER", "brapi").strip().lower()
MCP_BRAPI_URL = os.getenv("MCP_BRAPI_URL", "https://brapi.dev/api/mcp/mcp").strip()
MCP_LOCAL_URL = os.getenv(
    "MCP_LOCAL_URL",
    os.getenv("MCP_FINANCIAL_URL", "http://mcp-financial:8081/mcp"),
).strip()
BRAPI_API_KEY = os.getenv("BRAPI_API_KEY", "").strip()
MCP_URLS = {"brapi": MCP_BRAPI_URL, "local": MCP_LOCAL_URL}
if MCP_PROVIDER not in MCP_URLS:
    raise ValueError("MCP_PROVIDER must be either 'brapi' or 'local'")
MCP_FINANCIAL_URL = MCP_URLS[MCP_PROVIDER]

SYSTEM_PROMPT = """Você é um assistente financeiro informativo.
Explique conceitos com clareza, mostre cálculos quando úteis e peça contexto
quando a pergunta não trouxer dados suficientes. Não invente dados de mercado
nem apresente uma resposta como garantia de retorno.
Use português do Brasil por padrão. Responda no idioma usado pelo usuário;
quando a mensagem estiver em inglês, responda em inglês. Se o usuário misturar
idiomas, use o idioma predominante.
Seja conciso por padrão; aprofunde quando o usuário pedir ou quando o cálculo exigir.
Quando o usuário solicitar um guia estruturado, explicação técnica extensa ou
formatação profissional com títulos, listas aninhadas, tabelas GFM ou referências,
leia a Skill rich-text. Respostas curtas em Markdown comum não precisam dela.
Quando o usuário pedir para visualizar, comparar visualmente ou explorar dados
em um gráfico, leia a Skill chart-visualization, mesmo que a pergunta também
se encaixe em outra Skill. Leia também a Skill temática quando ela for necessária
para responder sobre investimentos ou operações bancárias. Se o pedido nomear
explicitamente um gráfico e houver dados compatíveis, retorne o bloco chart
exigido pela Skill em vez de responder apenas com uma tabela.
Quando o usuário pedir para criar, preparar ou visualizar um documento financeiro
formatado na conversa, sempre leia a Skill document-renderer, inclusive se precisar
explicar que faltam dados para emiti-lo. Com dados compatíveis, retorne o bloco
document exigido pela Skill; sem fonte ou dados suficientes, explique a limitação
sem criar payload. Não substitua um documento pronto por texto Markdown ou tabela
solta."""


def create_chat_model() -> BaseChatModel:
    """Build the configured OpenAI chat model lazily."""
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-6-luna"),
        reasoning_effort=os.getenv("OPENAI_REASONING_EFFORT", "low"),
    )
