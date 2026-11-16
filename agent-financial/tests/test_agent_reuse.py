import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from langchain_core.messages import AIMessage

from src.agent import _get_agent, answer


class AgentReuseTests(unittest.IsolatedAsyncioTestCase):
    def tearDown(self) -> None:
        _get_agent.cache_clear()

    def test_compiled_agent_is_cached_once(self) -> None:
        _get_agent.cache_clear()
        compiled_agent = object()

        with patch("src.agent._build_agent", return_value=compiled_agent) as build:
            self.assertIs(_get_agent(), compiled_agent)
            self.assertIs(_get_agent(), compiled_agent)

        build.assert_called_once_with()

    async def test_answer_uses_ainvoke_and_returns_final_text(self) -> None:
        invoke = AsyncMock(
            return_value={
                "messages": [AIMessage(content="Resposta simulada.")],
                "skills_metadata": [],
            }
        )
        compiled_agent = SimpleNamespace(ainvoke=invoke)

        with patch("src.agent._get_agent", return_value=compiled_agent):
            response = await answer("Pergunta simulada")

        self.assertEqual(response, "Resposta simulada.")
        invoke.assert_awaited_once_with(
            {"messages": [{"role": "user", "content": "Pergunta simulada"}]}
        )


if __name__ == "__main__":
    unittest.main()
