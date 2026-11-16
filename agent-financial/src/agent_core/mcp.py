"""MCP tool discovery for the financial assistant."""

from langchain.mcp import MCPAdapter
from langchain_core.tools import BaseTool

from .config import MCP_FINANCIAL_URL


async def discover_financial_mcp_tools() -> list[BaseTool]:
    """Discover tools from the configured financial MCP server."""
    async with MCPAdapter(MCP_FINANCIAL_URL) as adapter:
        return await adapter.list_tools()
