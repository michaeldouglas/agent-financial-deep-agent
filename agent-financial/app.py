import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException

from src.agent import answer
from src.schemas import ChatRequest, ChatResponse


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest) -> ChatResponse:
    try:
        return ChatResponse(resposta=await answer(payload.message))
    except Exception as e:
        logger.exception("Erro no /chat")
        raise HTTPException(status_code=502, detail="Não foi possível obter resposta do agente.") from e
