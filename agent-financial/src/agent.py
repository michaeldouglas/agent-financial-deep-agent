"""LangGraph-backed financial assistant using the OpenAI API."""

import time
from functools import lru_cache
from typing import Any

from deepagents import create_deep_agent
from langchain_core.language_models.chat_models import BaseChatModel

from .agent_core.config import SKILLS_SOURCE, SYSTEM_PROMPT, create_chat_model
from .agent_core.observability import log_request_metrics, log_skill_observability
from .agent_core.skills import (
    create_filesystem_middleware,
    create_filesystem_permissions,
    create_skills_backend,
)


def _build_agent(model: BaseChatModel | None = None) -> Any:
    """Create the financial agent, allowing a model to be injected in tests."""
    backend = create_skills_backend()
    permissions = create_filesystem_permissions()
    filesystem_middleware = create_filesystem_middleware(backend, permissions)
    if model is None:
        model = create_chat_model()

    return create_deep_agent(
        model=model,
        backend=backend,
        system_prompt=SYSTEM_PROMPT,
        skills=[SKILLS_SOURCE],
        permissions=permissions,
        middleware=[filesystem_middleware],
    )


@lru_cache(maxsize=1)
def _get_agent() -> Any:
    """Build the compiled agent once per process for reuse across requests."""
    return _build_agent()


async def answer(message: str) -> str:
    """Run a user message through the agent and return its final answer."""
    started_at = time.perf_counter()
    result = await _get_agent().ainvoke(
        {"messages": [{"role": "user", "content": message}]},
    )

    log_skill_observability(result)
    log_request_metrics(result, started_at)
    return result["messages"][-1].text.strip()
