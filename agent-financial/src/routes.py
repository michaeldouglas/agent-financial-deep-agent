import logging

from fastapi import APIRouter, HTTPException

from src.agent import answer, answer_with_skill
from src.schemas import ChatRequest, ChatResponse


logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest) -> ChatResponse:
    try:
        if payload.selected_skill is not None:
            response = await answer_with_skill(
                payload.message,
                payload.selected_skill,
            )
        else:
            response = await answer(payload.message)
        return ChatResponse(resposta=response)
    except Exception as exc:
        logger.exception("Erro no /chat")
        raise HTTPException(
            status_code=502,
            detail="Não foi possível obter resposta do agente.",
        ) from exc
