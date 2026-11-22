"""LangGraph-backed financial assistant using the OpenAI API."""

import logging
import time
from collections.abc import Sequence
from functools import lru_cache
from typing import Any

from deepagents import create_deep_agent
from deepagents.middleware.skills import SkillsMiddleware
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import BaseTool

from .agent_core.config import SKILLS_SOURCE, SYSTEM_PROMPT, create_chat_model
from .agent_core.observability import log_request_metrics, log_skill_observability
from .agent_core.skills import (
    create_filesystem_middleware,
    create_filesystem_permissions,
    create_skill_tool_resolver,
    create_skills_backend,
    missing_skill_mcp_tools,
)


_MCP_TOOLS: tuple[BaseTool, ...] = ()


def configure_mcp_tools(tools: Sequence[BaseTool]) -> None:
    """Set discovered MCP tools before the cached agent is first used."""
    global _MCP_TOOLS
    _MCP_TOOLS = tuple(tools)
    _get_agent.cache_clear()

    missing_tools = missing_skill_mcp_tools(_MCP_TOOLS)
    if missing_tools:
        logger.warning("MCP tools unavailable: %s", ",".join(missing_tools))
    else:
        logger.info(
            "MCP tools discovered: %s",
            ",".join(sorted(tool.name for tool in _MCP_TOOLS)),
        )


logger = logging.getLogger("src.agent")


def _build_agent(
    model: BaseChatModel | None = None,
    mcp_tools: Sequence[BaseTool] | None = None,
) -> Any:
    """Create the financial agent, allowing a model to be injected in tests."""
    backend = create_skills_backend()
    permissions = create_filesystem_permissions()
    filesystem_middleware = create_filesystem_middleware(backend, permissions)
    skills_middleware = SkillsMiddleware(
        backend=backend,
        sources=[SKILLS_SOURCE],
        tools=create_skill_tool_resolver(
            _MCP_TOOLS if mcp_tools is None else mcp_tools,
        ),
    )
    if model is None:
        model = create_chat_model()

    return create_deep_agent(
        model=model,
        backend=backend,
        system_prompt=SYSTEM_PROMPT,
        permissions=permissions,
        middleware=[filesystem_middleware, skills_middleware],
    )


@lru_cache(maxsize=1)
def _get_agent() -> Any:
    """Build the compiled agent once per process for reuse across requests."""
    return _build_agent()


async def _answer(
    message: str,
    selected_skills: list[str] | None = None,
) -> str:
    """Run a message, optionally pinning user-selected native Skills."""
    started_at = time.perf_counter()
    input_state: dict[str, Any] = {
        "messages": [{"role": "user", "content": message}],
    }
    if selected_skills:
        input_state["pinned_skills"] = list(dict.fromkeys(selected_skills))

    result = await _get_agent().ainvoke(
        input_state,
    )

    log_skill_observability(result)
    log_request_metrics(result, started_at)
    return result["messages"][-1].text.strip()


async def answer(message: str) -> str:
    """Run a user message through automatic native Skill selection."""
    return await _answer(message)


async def answer_with_skills(
    message: str,
    selected_skills: list[str],
) -> str:
    """Run a user message with one or more Skills explicitly pinned by the user."""
    return await _answer(message, selected_skills)


async def answer_with_skill(message: str, selected_skill: str) -> str:
    """Keep the single-Skill helper compatible with existing callers."""
    return await answer_with_skills(message, [selected_skill])
