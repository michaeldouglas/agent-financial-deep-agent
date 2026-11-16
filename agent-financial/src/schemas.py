"""HTTP request and response schemas for the chat API."""

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    message: str = Field(
        min_length=1,
        max_length=8_000,
        description="Pergunta ou instrução enviada ao assistente financeiro.",
        examples=["Explique a diferença entre CDI e Selic."],
    )
    selected_skill: str | None = Field(
        default=None,
        description="Campo compatível com clientes antigos que selecionam uma Skill.",
    )
    selected_skills: list[str] = Field(
        default_factory=list,
        max_length=10,
        description="Skills explicitamente selecionadas no chat, se houver.",
    )


class ChatResponse(BaseModel):
    resposta: str = Field(description="Resposta final do assistente ao usuário.")


class SkillSummary(BaseModel):
    name: str = Field(description="Identificador estável da Skill.")
    label: str = Field(description="Nome da Skill para exibição no aplicativo.")
    description: str = Field(description="Resumo da finalidade da Skill.")
