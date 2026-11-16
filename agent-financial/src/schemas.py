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


class ChatResponse(BaseModel):
    resposta: str = Field(description="Resposta final produzida pelo agente.")
