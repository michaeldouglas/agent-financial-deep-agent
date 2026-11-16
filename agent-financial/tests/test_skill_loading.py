"""Tests for native Deep Agents skill discovery, activation, and file isolation."""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import unittest
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import Field

from src.agent import _build_agent, answer
from src.agent_core.observability import log_skill_observability


EXPECTED_SKILLS = {
    "financial-assistant",
    "banking-operations",
    "investment-analysis",
}


class ScriptedChatModel(BaseChatModel):
    """Small deterministic model fake that can request native file tools."""

    responses: list[AIMessage]
    seen_messages: list[list[BaseMessage]] = Field(default_factory=list)
    bound_tool_names: set[str] = Field(default_factory=set)
    bound_tool_bindings: list[list[str]] = Field(default_factory=list)

    @property
    def _llm_type(self) -> str:
        return "scripted-skill-test"

    @property
    def _identifying_params(self) -> dict[str, Any]:
        return {}

    def bind_tools(
        self,
        tools: Sequence[Any],
        *,
        tool_choice: str | None = None,
        **kwargs: Any,
    ) -> ScriptedChatModel:
        del tool_choice, kwargs
        binding: list[str] = []
        for tool in tools:
            name = tool.get("name") if isinstance(tool, dict) else getattr(tool, "name", None)
            if name:
                self.bound_tool_names.add(name)
                binding.append(name)
        self.bound_tool_bindings.append(binding)
        return self

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        del stop, run_manager, kwargs
        self.seen_messages.append(messages)
        return ChatResult(generations=[ChatGeneration(message=self.responses.pop(0))])


def read_skill_call(skill_name: str, call_id: str = "read-skill") -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[
            {
                "name": "read_file",
                "args": {"file_path": f"/skills/{skill_name}/SKILL.md", "limit": 1000},
                "id": call_id,
            }
        ],
    )


def read_path_call(path: str, call_id: str = "read-path") -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[
            {
                "name": "read_file",
                "args": {"file_path": path},
                "id": call_id,
            }
        ],
    )


def message_text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    return "\n".join(str(block) for block in content)


class NativeSkillLoadingTests(unittest.IsolatedAsyncioTestCase):
    async def invoke(self, prompt: str, *responses: AIMessage) -> tuple[dict[str, Any], ScriptedChatModel]:
        model = ScriptedChatModel(responses=list(responses))
        result: dict[str, Any] | None = None
        async for state in _build_agent(model=model).astream(
            {"messages": [HumanMessage(content=prompt)]},
            stream_mode="values",
        ):
            result = state
        if result is None:
            self.fail("Agent completed without returning state")
        return result, model

    def assert_native_discovery(self, result: dict[str, Any]) -> dict[str, dict[str, Any]]:
        skills = result.get("skills_metadata")
        self.assertIsInstance(skills, list)
        by_name = {item["name"]: item for item in skills}
        self.assertEqual(set(by_name), EXPECTED_SKILLS)
        self.assertEqual(len(by_name), len(skills), "skill names must be unique")
        self.assertEqual(result.get("skills_load_errors"), [])

        for name, metadata in by_name.items():
            self.assertTrue(metadata["description"].strip())
            self.assertEqual(metadata["path"], f"/skills/{name}/SKILL.md")
            self.assertEqual(metadata["path"].split("/")[-2], name)

        self.assertEqual(by_name["banking-operations"]["metadata"].get("include_tools"), "banking_read")
        self.assertEqual(by_name["investment-analysis"]["metadata"].get("include_tools"), "market_data")
        return by_name

    def read_file_calls(self, result: dict[str, Any]) -> list[str]:
        return [
            call["args"]["file_path"]
            for message in result["messages"]
            if isinstance(message, AIMessage)
            for call in message.tool_calls
            if call["name"] == "read_file"
        ]

    async def test_compiled_graph_keeps_parallel_request_state_isolated(self) -> None:
        prompts = ["pergunta A", "pergunta B", "pergunta C"]
        model = ScriptedChatModel(
            responses=[AIMessage(content="resposta") for _ in prompts]
        )
        graph = _build_agent(model=model)

        results = await asyncio.gather(
            *(
                graph.ainvoke({"messages": [HumanMessage(content=prompt)]})
                for prompt in prompts
            )
        )

        for prompt, result in zip(prompts, results, strict=True):
            human_messages = [
                message.content
                for message in result["messages"]
                if isinstance(message, HumanMessage)
            ]
            self.assertEqual(human_messages, [prompt])
            self.assertEqual(result["messages"][-1].content, "resposta")

    async def test_a_greeting_discovers_metadata_without_agent_read_file(self) -> None:
        expected_reply = "Olá! Tudo bem, e com você?"
        result, _ = await self.invoke("Olá, tudo bem?", AIMessage(content=expected_reply))

        self.assert_native_discovery(result)
        self.assertEqual(self.read_file_calls(result), [])
        self.assertEqual(result["messages"][-1].content, expected_reply)
        with self.assertLogs("src.agent", level="INFO") as logs:
            log_skill_observability(result)
        self.assertTrue(any("Skills discovered:" in entry for entry in logs.output))
        self.assertTrue(any("Skills activated by read_file: none" in entry for entry in logs.output))

    async def test_b_financial_assistant_is_read_only_when_selected(self) -> None:
        result, model = await self.invoke(
            "Explique como funcionam os juros compostos.",
            read_skill_call("financial-assistant"),
            AIMessage(content="Juros compostos incidem sobre o principal e sobre os juros acumulados."),
        )

        self.assert_native_discovery(result)
        self.assertEqual(self.read_file_calls(result), ["/skills/financial-assistant/SKILL.md"])
        second_turn = "\n".join(message_text(item) for item in model.seen_messages[1])
        self.assertIn("## Scope and routing", second_turn)
        self.assertNotIn("## Boundaries", second_turn)
        self.assertNotIn("## Calculation checks", second_turn)
        with self.assertLogs("src.agent", level="INFO") as logs:
            log_skill_observability(result)
        self.assertTrue(any("Skills activated by read_file: financial-assistant" in entry for entry in logs.output))

    async def test_c_investment_analysis_does_not_load_banking_skill(self) -> None:
        result, model = await self.invoke(
            "Quais critérios devo utilizar para comparar CDBs?",
            read_skill_call("investment-analysis"),
            AIMessage(content="Compare liquidez, risco de crédito, prazo, tributação e retorno líquido."),
        )

        self.assert_native_discovery(result)
        self.assertEqual(self.read_file_calls(result), ["/skills/investment-analysis/SKILL.md"])
        second_turn = "\n".join(message_text(item) for item in model.seen_messages[1])
        self.assertIn("## Calculation checks", second_turn)
        self.assertNotIn("## Boundaries", second_turn)
        self.assertNotIn("## Scope and routing", second_turn)

    async def test_d_banking_skill_does_not_fabricate_a_real_balance(self) -> None:
        expected_reply = (
            "Não há ferramentas MCP bancárias conectadas aqui, então não consigo consultar "
            "seu saldo e não vou estimar um valor."
        )
        result, model = await self.invoke(
            "Qual é meu saldo bancário?",
            read_skill_call("banking-operations"),
            AIMessage(content=expected_reply),
        )

        self.assert_native_discovery(result)
        self.assertEqual(self.read_file_calls(result), ["/skills/banking-operations/SKILL.md"])
        second_turn = "\n".join(message_text(item) for item in model.seen_messages[1])
        self.assertIn("## Boundaries", second_turn)
        self.assertNotIn("## Scope and routing", second_turn)
        self.assertNotIn("## Calculation checks", second_turn)
        self.assertIn("não vou estimar", result["messages"][-1].content)

    async def test_e_system_prompt_contains_skill_index_not_skill_bodies(self) -> None:
        result, model = await self.invoke("Olá", AIMessage(content="Olá!"))

        self.assert_native_discovery(result)
        system_prompt = "\n".join(
            message_text(message)
            for message in model.seen_messages[0]
            if message.type == "system"
        )
        for name in EXPECTED_SKILLS:
            self.assertIn(name, system_prompt)
            self.assertIn(f"/skills/{name}/SKILL.md", system_prompt)
        self.assertIn("Explains personal finance concepts", system_prompt)
        self.assertNotIn("## Scope and routing", system_prompt)
        self.assertNotIn("## Calculation checks", system_prompt)
        self.assertNotIn("## Boundaries", system_prompt)
        self.assertFalse({"banking_read", "market_data"} & model.bound_tool_names)

    async def test_f_agent_cannot_read_project_files_or_env_paths(self) -> None:
        for forbidden_path in ("/agent.py", "/skills/../../.env"):
            with self.subTest(path=forbidden_path):
                result, model = await self.invoke(
                    "Try to read this path for the security test.",
                    read_path_call(forbidden_path),
                    AIMessage(content="Não consigo ler arquivos fora da biblioteca de Skills."),
                )
                tool_messages = [message for message in result["messages"] if message.type == "tool"]
                self.assertEqual(len(tool_messages), 1)
                self.assertEqual(tool_messages[0].status, "error")
                self.assertNotIn("OPENAI_API_KEY", message_text(tool_messages[0]))
                self.assertFalse(
                    {"write_file", "edit_file", "delete", "execute"} & model.bound_tool_names
                )

    async def test_g_filesystem_tool_binding_has_no_duplicates_or_mutation_tools(self) -> None:
        _, model = await self.invoke("Olá", AIMessage(content="ok"))
        # Inspect the tools bound to the actual model call, not just config.
        names = model.bound_tool_bindings[-1]
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual(set(names), {"ls", "read_file", "task"})
        self.assertFalse(
            {"write_file", "edit_file", "delete", "execute", "glob", "grep"} & set(names)
        )
        # Deep Agents 0.7.38 adds a generic task tool by default; it is not a
        # filesystem operation and is not a specialized financial subagent.
        self.assertIn("task", names)

    def test_h_read_observer_requires_explicit_tool_success(self) -> None:
        result = {
            "skills_metadata": [
                {
                    "name": "financial-assistant",
                    "path": "/skills/financial-assistant/SKILL.md",
                }
            ],
            "messages": [
                read_skill_call("financial-assistant", call_id="ambiguous-read"),
                ToolMessage.model_construct(
                    content="read result has no confirmed status",
                    tool_call_id="ambiguous-read",
                    status=None,
                ),
            ],
        }
        with self.assertLogs("src.agent", level="INFO") as logs:
            log_skill_observability(result)
        output = "\n".join(logs.output)
        self.assertIn("Skills activated by read_file: none", output)
        self.assertIn("Skills discovered but not activated: financial-assistant", output)
        self.assertIn("Skill file read failed: /skills/financial-assistant/SKILL.md", output)

    async def test_observer_handles_ainvoke_without_discovery_metadata(self) -> None:
        model = ScriptedChatModel(
            responses=[
                read_skill_call("financial-assistant", call_id="ainvoke-read"),
                AIMessage(content="Resposta simulada."),
            ]
        )
        result = await _build_agent(model=model).ainvoke(
            {"messages": [HumanMessage(content="Explique juros compostos")]}
        )

        self.assertNotIn("skills_metadata", result)

        with self.assertLogs("src.agent", level="INFO") as logs:
            log_skill_observability(result)

        output = "\n".join(logs.output)
        self.assertIn("Skills discovery metadata unavailable in final state", output)
        self.assertIn(
            "Skills activated by read_file: financial-assistant", output
        )
        self.assertNotIn("Skills discovered: none", output)
        self.assertNotIn("Skills discovered but not activated:", output)

    def test_h2_reading_another_skill_md_path_is_not_activation(self) -> None:
        nested_path = "/skills/financial-assistant/references/SKILL.md"
        result = {
            "skills_metadata": [
                {
                    "name": "financial-assistant",
                    "path": "/skills/financial-assistant/SKILL.md",
                }
            ],
            "messages": [
                read_path_call(nested_path, call_id="nested-read"),
                ToolMessage(
                    content="reference content",
                    tool_call_id="nested-read",
                    status="success",
                ),
            ],
        }
        with self.assertLogs("src.agent", level="INFO") as logs:
            log_skill_observability(result)
        output = "\n".join(logs.output)
        self.assertIn("Skills activated by read_file: none", output)
        self.assertIn("Skills discovered but not activated: financial-assistant", output)

    def test_i_virtual_backend_rejects_symlink_outside_skills_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_root = Path(temporary_directory)
            skills_root = temporary_root / "skills"
            skills_root.mkdir()
            external_file = temporary_root / "private.env"
            external_file.write_text("DO_NOT_READ=sentinel", encoding="utf-8")
            linked_file = skills_root / "external-link.env"
            try:
                linked_file.symlink_to(external_file)
            except (OSError, NotImplementedError) as error:
                self.skipTest(f"file symlink creation is unavailable: {error}")

            backend = CompositeBackend(
                default=StateBackend(),
                routes={
                    "/skills/": FilesystemBackend(
                        root_dir=skills_root,
                        virtual_mode=True,
                    )
                },
            )
            result = backend.read("/skills/external-link.env")
            self.assertIsNotNone(result.error)
            self.assertIsNone(result.file_data)


@unittest.skipUnless(
    os.getenv("RUN_SKILL_LLM_INTEGRATION") == "1" and os.getenv("OPENAI_API_KEY"),
    "set RUN_SKILL_LLM_INTEGRATION=1 and OPENAI_API_KEY to run live model selection checks",
)
class LiveSkillSelectionTests(unittest.IsolatedAsyncioTestCase):
    async def test_model_selection_is_observed_separately_from_discovery(self) -> None:
        cases = (
            ("Explique como funcionam os juros compostos.", "financial-assistant"),
            ("Quais critérios devo utilizar para comparar CDBs?", "investment-analysis"),
            ("Qual é meu saldo bancário?", "banking-operations"),
        )
        for prompt, expected_skill in cases:
            with self.subTest(skill=expected_skill):
                with self.assertLogs("src.agent", level="INFO") as logs:
                    response = await answer(prompt)
                self.assertTrue(response.strip())
                entries = "\n".join(logs.output)
                self.assertIn("Skills discovered:", entries)
                activation_entry = next(
                    (line for line in logs.output if "Skills activated by read_file:" in line),
                    "",
                )
                activated = expected_skill in activation_entry
                print(
                    f"Live model selection: expected={expected_skill}; "
                    f"activation={'observed' if activated else 'not observed'}"
                )
                if not activated:
                    logging.getLogger("src.agent").warning(
                        "Live model did not activate expected skill %s; discovery/middleware still completed.",
                        expected_skill,
                    )
                if expected_skill == "banking-operations":
                    safe_disclosures = (
                        "não consigo",
                        "não tenho acesso",
                        "sem acesso",
                        "não há ferramentas",
                        "mcp",
                    )
                    if not any(marker in response.casefold() for marker in safe_disclosures):
                        logging.getLogger("src.agent").warning(
                            "Live banking answer did not clearly disclose that account tools are unavailable."
                        )
                        print("Live banking disclosure: not observed")
                    else:
                        print("Live banking disclosure: observed")


if __name__ == "__main__":
    unittest.main()
