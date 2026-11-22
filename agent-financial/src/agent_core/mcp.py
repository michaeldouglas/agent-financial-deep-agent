"""MCP tool discovery for the financial assistant."""

from langchain.mcp import MCPAdapter
from langchain_core.tools import BaseTool

from .config import BRAPI_API_KEY, MCP_FINANCIAL_URL, MCP_PROVIDER


def _mcp_target():
    if MCP_PROVIDER == "brapi" and BRAPI_API_KEY:
        from fastmcp import Client
        from fastmcp.client.transports import StreamableHttpTransport

        transport = StreamableHttpTransport(
            MCP_FINANCIAL_URL,
            headers={"Authorization": f"Bearer {BRAPI_API_KEY}"},
        )
        return Client(transport)
    return MCP_FINANCIAL_URL


async def discover_financial_mcp_tools() -> list[BaseTool]:
    """Discover tools from the configured financial MCP server."""
    async with MCPAdapter(_mcp_target()) as adapter:
        return await adapter.list_tools()
