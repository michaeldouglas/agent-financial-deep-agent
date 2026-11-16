"""LangGraph-backed financial assistant using the OpenAI API."""

import logging
import os
import re
import time
from pathlib import Path
from typing import Any

from deepagents.backends import FilesystemBackend
from deepagents import create_deep_agent
from deepagents.middleware.skills import SkillsMiddleware
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

load_dotenv()

SYSTEM_PROMPT = """Você é um assistente financeiro informativo.
Explique conceitos com clareza, mostre cálculos quando úteis e peça contexto
quando a pergunta não trouxer dados suficientes. Não invente dados de mercado
nem apresente uma resposta como garantia de retorno.
Seja conciso por padrão; aprofunde quando o usuário pedir ou quando o cálculo exigir."""

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = PROJECT_ROOT / "skills"


def _load_skill_instructions() -> str:
    """Load skill bodies once at startup so each request avoids a read_file turn."""
    instructions = []
    for skill_file in sorted(SKILLS_ROOT.rglob("SKILL.md")):
        content = skill_file.read_text(encoding="utf-8")
        content = re.sub(
            r"\A---\s*\n.*?\n---\s*\n",
            "",
            content,
            count=1,
            flags=re.DOTALL,
        ).strip()
        if content:
            instructions.append(content)
    return "\n\n".join(instructions)


def resolve_skill_tools(name: str, runtime: Any) -> list[Any]:
    """Resolve named skill tools; skills without registered tools get none."""
    del runtime
    return []


def _build_agent() -> Any:
    backend = FilesystemBackend(root_dir=str(PROJECT_ROOT))
    skill_instructions = _load_skill_instructions()
    model = ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-6-luna"),
        reasoning_effort=os.getenv("OPENAI_REASONING_EFFORT", "low"),
    )
    return create_deep_agent(
        model=model,
        backend=backend,
        system_prompt=f"{SYSTEM_PROMPT}\n\n{skill_instructions}",
        middleware=[
            SkillsMiddleware(
                backend=backend,
                sources=["/skills/"],
                tools=resolve_skill_tools,
                system_prompt=None,
            ),
        ],
    )


async def answer(message: str) -> str:
    """Run a user message through the agent and return its final answer."""
    started_at = time.perf_counter()
    result = await _build_agent().ainvoke(
        {"messages": [{"role": "user", "content": message}]}
    )
    messages = result["messages"]
    tool_names = [
        call.get("name", "unknown")
        for message_item in messages
        for call in getattr(message_item, "tool_calls", [])
    ]
    logger.info(
        "Agent request completed in %.2fs (%d messages; tools=%s)",
        time.perf_counter() - started_at,
        len(messages),
        ",".join(tool_names) if tool_names else "none",
    )
    return messages[-1].text.strip()
