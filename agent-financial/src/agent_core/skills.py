"""Read-only filesystem configuration for native Deep Agents Skills."""

from collections.abc import Callable, Sequence
from typing import Any

from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from deepagents.middleware.filesystem import FilesystemMiddleware, FilesystemPermission
from deepagents.middleware.skills import SkillsMiddleware
from langchain_core.tools import BaseTool
from langgraph.runtime import Runtime

from .config import SKILLS_ROOT, SKILLS_SOURCE

SKILL_TOOL_GROUPS = {
    "banking_read": (
        "mock_get_account_balance",
        "mock_list_transactions",
    ),
    "market_data": ("mock_get_market_quote",),
}


def create_skill_tool_resolver(
    tools: Sequence[BaseTool],
) -> Callable[[str, Runtime[Any]], list[BaseTool]]:
    """Resolve declarative Skill tool groups to discovered MCP tools."""
    tools_by_name = {tool.name: tool for tool in tools}

    def resolve(group_name: str, _runtime: Runtime[Any]) -> list[BaseTool]:
        return [
            tools_by_name[name]
            for name in SKILL_TOOL_GROUPS.get(group_name, ())
            if name in tools_by_name
        ]

    return resolve


def missing_skill_mcp_tools(tools: Sequence[BaseTool]) -> list[str]:
    """List required mock MCP tool names absent from server discovery."""
    available_names = {tool.name for tool in tools}
    required_names = {
        tool_name
        for group in SKILL_TOOL_GROUPS.values()
        for tool_name in group
    }
    return sorted(required_names - available_names)


def create_filesystem_permissions() -> list[FilesystemPermission]:
    """Allow reads only inside the Skills library and deny every write."""
    return [
        # Filesystem permissions are first-match: allow Skills reads, then deny
        # every other read and all writes.
        FilesystemPermission(
            operations=["read"],
            paths=["/skills/**"],
            mode="allow",
        ),
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/**"],
            mode="deny",
        ),
    ]


def create_skills_backend() -> CompositeBackend:
    """Route Skills to a virtual, root-confined filesystem backend."""
    return CompositeBackend(
        default=StateBackend(),
        routes={
            SKILLS_SOURCE: FilesystemBackend(
                root_dir=str(SKILLS_ROOT),
                virtual_mode=True,
            ),
        },
    )


def discover_skills() -> list[dict[str, str]]:
    """Return the catalog discovered by Deep Agents' native SkillsMiddleware."""
    middleware = SkillsMiddleware(
        backend=create_skills_backend(),
        sources=[SKILLS_SOURCE],
    )
    state = middleware.before_agent(
        {"skills_metadata": None},
        runtime=None,  # type: ignore[arg-type]
        config={},  # type: ignore[arg-type]
    )
    if state is None:
        return []

    errors = state.get("skills_load_errors") or []
    if errors:
        raise RuntimeError("Deep Agents could not load the Skills catalog.")

    skills = state.get("skills_metadata") or []
    return sorted(
        [
            {
                "name": skill["name"],
                "description": skill["description"],
            }
            for skill in skills
        ],
        key=lambda skill: skill["name"],
    )


def create_filesystem_middleware(
    backend: CompositeBackend,
    permissions: list[FilesystemPermission],
) -> FilesystemMiddleware:
    """Expose only the listing and reading tools required by Skills."""
    return FilesystemMiddleware(
        backend=backend,
        tools=["ls", "read_file"],
        permissions=permissions,
    )
