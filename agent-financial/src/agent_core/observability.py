"""Logging for Skill discovery, activation, and agent request metrics."""

import logging
import time
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from .config import SKILLS_SOURCE

# Retain the existing logger name so log configuration and consumers keep
# receiving the same event namespace after the module split.
logger = logging.getLogger("src.agent")


def _skill_name_for_path(path: str) -> str | None:
    """Return a skill name only for a virtual path inside the Skills library."""
    if not path.startswith(SKILLS_SOURCE):
        return None
    parts = path[len(SKILLS_SOURCE) :].split("/")
    if len(parts) < 2 or not parts[0] or ".." in parts:
        return None
    return parts[0]


def log_skill_observability(result: dict[str, Any]) -> None:
    """Log native discovery state and only confirmed read_file outcomes."""
    metadata_available = (
        "skills_metadata" in result and result["skills_metadata"] is not None
    )
    skills = result.get("skills_metadata") or []
    discovered = {
        str(skill.get("name")): str(skill.get("path"))
        for skill in skills
        if skill.get("name") and skill.get("path")
    }
    if metadata_available:
        logger.info("Skills discovered: %s", ",".join(sorted(discovered)) or "none")
    else:
        logger.info("Skills discovery metadata unavailable in final state")

    for error in result.get("skills_load_errors") or []:
        logger.warning("Skill discovery failed: %s", error)

    pending_reads: dict[str, str] = {}
    successful_reads: set[str] = set()
    failed_reads: set[str] = set()
    pinned_activations: set[str] = set()
    for message in result.get("messages", []):
        if isinstance(message, AIMessage):
            for call in message.tool_calls:
                if call.get("name") != "read_file":
                    continue
                args = call.get("args", {})
                path = args.get("file_path")
                call_id = call.get("id")
                if isinstance(path, str) and isinstance(call_id, str) and _skill_name_for_path(path):
                    pending_reads[call_id] = path
        elif isinstance(message, HumanMessage):
            additional_kwargs = message.additional_kwargs
            skill = additional_kwargs.get("skill")
            if additional_kwargs.get("lc_source") != "pinned_skill" or not isinstance(skill, dict):
                continue
            name = skill.get("name")
            path = skill.get("path")
            if (
                isinstance(name, str)
                and isinstance(path, str)
                and path == f"{SKILLS_SOURCE}{name}/SKILL.md"
            ):
                pinned_activations.add(name)
        elif isinstance(message, ToolMessage) and message.tool_call_id in pending_reads:
            path = pending_reads[message.tool_call_id]
            # Only explicit success proves that read_file completed.
            if message.status == "success":
                successful_reads.add(path)
            else:
                failed_reads.add(path)

    activated = set(pinned_activations)
    for path in successful_reads:
        name = _skill_name_for_path(path)
        if name is None or path != f"{SKILLS_SOURCE}{name}/SKILL.md":
            continue
        if not metadata_available or discovered.get(name) == path:
            activated.add(name)

    logger.info(
        "Skills activated by read_file: %s; files=%s",
        ",".join(sorted(activated)) or "none",
        ",".join(sorted(successful_reads)) or "none",
    )
    logger.info(
        "Skills activated by pinned_skills: %s",
        ",".join(sorted(pinned_activations)) or "none",
    )
    if metadata_available:
        not_activated = set(discovered) - activated
        logger.info(
            "Skills discovered but not activated: %s",
            ",".join(sorted(not_activated)) or "none",
        )
    for path in sorted(failed_reads):
        logger.warning("Skill file read failed: %s", path)


def log_request_metrics(result: dict[str, Any], started_at: float) -> None:
    """Log elapsed time, message count, and called tools without message content."""
    messages = result["messages"]
    tool_names = [
        call.get("name", "unknown")
        for message in messages
        for call in getattr(message, "tool_calls", [])
    ]
    logger.info(
        "Agent request completed in %.2fs (%d messages; tools=%s)",
        time.perf_counter() - started_at,
        len(messages),
        ",".join(tool_names) if tool_names else "none",
    )
