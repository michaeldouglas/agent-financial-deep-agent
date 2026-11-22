"""Read-only filesystem configuration for native Deep Agents Skills."""

from collections.abc import Callable, Sequence
from typing import Any

from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from deepagents.middleware.filesystem import FilesystemMiddleware, FilesystemPermission
from deepagents.middleware.skills import SkillsMiddleware
from langchain_core.tools import BaseTool
from langgraph.runtime import Runtime

from .config import MCP_PROVIDER, SKILLS_ROOT, SKILLS_SOURCE
from .skill_python import run_skill_python_script

LOCAL_SKILL_TOOL_GROUPS = {
    "banking_read": (
        "mock_get_account_balance",
        "mock_list_transactions",
    ),
    "chart_data": ("mock_get_chart_dataset",),
    "market_data": ("mock_get_market_quote",),
}

BRAPI_SKILL_TOOL_GROUPS = {
    "banking_read": (),
    "chart_data": (
        "get_stock_quote",
        "get_stock_historical",
        "get_fii_historical",
        "get_fii_indicators_history",
        "get_funds_nav_history",
        "get_currency_rates",
        "get_crypto_prices",
        "get_macro_series",
        "get_macro_series_latest",
        "get_inflation_data",
        "get_treasury_indicators_history",
    ),
    "market_data": (
        "get_stock_quote",
        "get_stock_historical",
        "get_stock_dividends",
        "get_stock_statistics",
        "get_stock_financial_data",
        "get_stock_balance_sheet",
        "get_stock_income_statement",
        "get_stock_cash_flow",
        "get_fii_list",
        "get_fii_indicators",
        "get_fii_indicators_history",
        "get_fii_historical",
        "get_fii_dividends",
        "get_fii_portfolio",
        "get_funds_list",
        "get_funds_indicators",
        "get_funds_nav_history",
        "get_funds_dividends",
        "get_funds_holdings",
        "get_funds_portfolio",
        "get_treasury_list",
        "get_treasury_indicators",
        "get_treasury_indicators_history",
        "get_macro_series",
        "get_macro_series_latest",
        "get_inflation_data",
        "get_prime_rate_data",
        "get_currency_rates",
        "get_crypto_prices",
        "get_option_expirations",
        "get_option_chain",
        "get_option_analytics",
        "get_futures_list",
        "get_futures_quote",
        "get_futures_historical",
        "get_market_news",
        "get_company_news",
        "get_ticker_coverage",
        "get_tickers",
        "get_dictionary",
    ),
}


def create_skill_tool_resolver(
    tools: Sequence[BaseTool],
) -> Callable[[str, Runtime[Any]], list[BaseTool]]:
    """Resolve declarative Skill tool groups to discovered MCP tools."""
    tools_by_name = {tool.name: tool for tool in tools}
    groups = {
        "banking_read": LOCAL_SKILL_TOOL_GROUPS["banking_read"],
        "chart_data": (*BRAPI_SKILL_TOOL_GROUPS["chart_data"], *LOCAL_SKILL_TOOL_GROUPS["chart_data"]),
        "market_data": (*BRAPI_SKILL_TOOL_GROUPS["market_data"], *LOCAL_SKILL_TOOL_GROUPS["market_data"]),
    }

    def resolve(group_name: str, _runtime: Runtime[Any]) -> list[BaseTool]:
        if group_name == "python_scripts":
            return [run_skill_python_script]
        return [
            tools_by_name[name]
            for name in groups.get(group_name, ())
            if name in tools_by_name
        ]

    return resolve


def missing_skill_mcp_tools(tools: Sequence[BaseTool]) -> list[str]:
    """List provider-specific skill MCP tools absent from server discovery."""
    available_names = {tool.name for tool in tools}
    required_names = (
        {"get_stock_quote", "get_stock_historical"}
        if MCP_PROVIDER == "brapi"
        else {tool_name for group in LOCAL_SKILL_TOOL_GROUPS.values() for tool_name in group}
    )
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
    """Return every agent Skill plus its frontend-only manual-pinning flag."""
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
                # This controls only whether the frontend offers the Skill for
                # manual pinning. SkillsMiddleware still discovers every Skill.
                "user_invocable": skill.get("metadata", {}).get(
                    "user_invocable", "true"
                ),
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
