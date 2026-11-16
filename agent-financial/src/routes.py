import asyncio
import logging

from fastapi import APIRouter, Header, HTTPException

from src.agent import answer, answer_with_skills
from src.agent_core.skills import discover_skills
from src.schemas import ChatRequest, ChatResponse, SkillSummary


logger = logging.getLogger(__name__)
router = APIRouter()

SKILL_LABELS_PT_BR = {
    "banking-operations": "Operações bancárias",
    "financial-assistant": "Educação financeira",
    "investment-analysis": "Análise de investimentos",
}
SKILL_DESCRIPTIONS_PT_BR = {
    "banking-operations": (
        "Orienta sobre consultas bancárias autorizadas. A confirmação de saldos "
        "e transações reais depende de ferramentas bancárias conectadas."
    ),
    "financial-assistant": (
        "Explica conceitos de finanças pessoais, orçamento, juros, crédito, "
        "reserva de emergência e cálculos gerais."
    ),
    "investment-analysis": (
        "Ajuda a comparar investimentos, avaliar riscos, custos e retornos "
        "potenciais. Dados atuais de mercado precisam de uma fonte conectada."
    ),
}


def _prefers_english(accept_language: str | None) -> bool:
    if not accept_language:
        return False
    preferred_language = accept_language.split(",", maxsplit=1)[0]
    preferred_language = preferred_language.split(";", maxsplit=1)[0].strip().lower()
    return preferred_language == "en" or preferred_language.startswith("en-")


def _localized_message(
    accept_language: str | None,
    portuguese: str,
    english: str,
) -> str:
    return english if _prefers_english(accept_language) else portuguese


def _skill_summary(skill: dict[str, str], *, english: bool) -> SkillSummary:
    name = skill["name"]
    if english:
        label = name.replace("-", " ").title()
        description = skill["description"]
    else:
        label = SKILL_LABELS_PT_BR.get(name, name.replace("-", " ").title())
        description = SKILL_DESCRIPTIONS_PT_BR.get(name, skill["description"])
    return SkillSummary(name=name, label=label, description=description)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get(
    "/skills",
    response_model=list[SkillSummary],
    summary="Listar Skills disponíveis",
    description="Retorna as Skills descobertas pelo middleware nativo do agente.",
)
def skills_endpoint(
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
) -> list[SkillSummary]:
    try:
        english = _prefers_english(accept_language)
        return [
            _skill_summary(skill, english=english)
            for skill in discover_skills()
        ]
    except Exception as exc:
        logger.exception("Erro ao carregar o catálogo de Skills")
        raise HTTPException(
            status_code=503,
            detail=_localized_message(
                accept_language,
                "Não foi possível carregar as Skills disponíveis.",
                "Could not load the available Skills.",
            ),
        ) from exc


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Enviar mensagem ao assistente",
    description=(
        "Responde em português do Brasil por padrão e acompanha o idioma da "
        "mensagem quando o usuário escrever em inglês."
    ),
)
async def chat_endpoint(
    payload: ChatRequest,
    accept_language: str | None = Header(default=None, alias="Accept-Language"),
) -> ChatResponse:
    try:
        selected_skills = list(payload.selected_skills)
        if (
            payload.selected_skill is not None
            and payload.selected_skill not in selected_skills
        ):
            selected_skills.append(payload.selected_skill)

        if selected_skills:
            catalog = await asyncio.to_thread(discover_skills)
            available_skills = {skill["name"] for skill in catalog}
            if not set(selected_skills).issubset(available_skills):
                raise HTTPException(
                    status_code=422,
                    detail=_localized_message(
                        accept_language,
                        "Uma ou mais Skills selecionadas não estão disponíveis.",
                        "One or more selected Skills are unavailable.",
                    ),
                )
            response = await answer_with_skills(
                payload.message,
                selected_skills,
            )
        else:
            response = await answer(payload.message)
        return ChatResponse(resposta=response)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Erro no /chat")
        raise HTTPException(
            status_code=502,
            detail=_localized_message(
                accept_language,
                "Não foi possível obter resposta do agente.",
                "Could not get a response from the assistant.",
            ),
        ) from exc
