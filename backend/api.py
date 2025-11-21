import os
import json
from pathlib import Path
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import asyncio
import shlex
from openai import OpenAI
from google import genai
from google.genai import types

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://muyaho.yuntae.in"],
    allow_credentials=True,
    allow_methods=["https://muyaho.yuntae.in"],
    allow_headers=["https://muyaho.yuntae.in"],
)

IMAGES_DIR = Path("./images")
STATE_FILE = "./processing_state.json"
STORE_PY_FILE = "store.py"

openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

build_lock = asyncio.Lock()

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"processed_images": {}, "vector_store_id": None}

class SearchQuery(BaseModel):
    query: str
    enable_semantic: bool = False

class SearchResult(BaseModel):
    image_id: str
    score: float

class KeywordsResponse(BaseModel):
    related_keywords: List[str]
    rewritten_query: str

@app.post("/semantic_search")
async def semantic_search(search_query: SearchQuery) -> List[SearchResult]:
    state = load_state()
    if not state["vector_store_id"]:
        raise HTTPException(status_code=404, detail="Vector store not found. Please build dataset first.")
    
    vector_store_id = state["vector_store_id"]
    results = openai_client.vector_stores.search(
        vector_store_id=vector_store_id,
        query=search_query.query,
        max_num_results=10
    )
    
    search_results = []
    for result in results.data:
        if hasattr(result, 'attributes') and result.attributes:
            image_id = result.attributes.get('image_id')
            score = getattr(result, 'score', 0.0)
            if image_id:
                search_results.append(SearchResult(
                    image_id=image_id,
                    score=score
                ))
    return search_results

@app.post("/direct_search")
async def direct_search(search_query: SearchQuery) -> List[SearchResult]:
    state = load_state()
    if not state.get("processed_images"):
        raise HTTPException(status_code=404, detail="No processed images found")
    
    needle = search_query.query.lower()
    results = []
    for filename, meta in state["processed_images"].items():
        ocr_text = meta.get("ocr_text", "").lower()
        if needle in ocr_text:
            results.append(SearchResult(image_id=meta["image_id"], score=1.0))
    
    if not results:
        raise HTTPException(status_code=404, detail="No matching images found")
    return results

@app.post("/keywords", response_model=KeywordsResponse)
async def generate_keywords(search_query: SearchQuery) -> KeywordsResponse:
    """
    Generate related keywords and rewritten query from user input using Gemini
    """
    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=search_query.query)]
        )
    ]

    generate_content_config = types.GenerateContentConfig(
        temperature=0.5,
        thinking_config=types.ThinkingConfig(
            thinking_budget=0,
        ),
        system_instruction=[
            types.Part.from_text(text="""사용자가 입력한 이미지에 대한 query를 바탕으로, 의미적으로 연관된 5~10개의 이미지 묘사 키워드와 semantic vector retrieval에 최적화된 rewritten_query를 생성하여 JSON 객체로 반환하세요.

- 반드시 입력 query와 의미적으로 연관된 이미지 context 기반 keyword를 최소 2개, 최대 10개 생성합니다.
- 키워드는 입력 query가 묘사하는 이미지 맥락과 주제를 반영해야 하며, 일반적·포괄적인 단어(예: '사진', '물건', '사람')는 피하고 이미지 내용이나 장면에 특화된 키워드여야 합니다.
- rewritten_query 항목에는 사용자의 이미지 query를 vector store의 semantic search에 적합하도록 자연스러운 plain text 이미지 묘사 문장으로 재구성해 제공합니다.
- 연관성에 대한 논리적 이유나 연관 기준을 반드시 내부적으로 단계별로 사고한 후, 마지막에 결과(JSON)만 반환하세요. (즉, reasoning → 결과 순서로 반드시 처리)
- 오직 JSON 객체만 반환해야 하며, 불필요한 설명이나 부연은 포함하지 않습니다.

# 상세 단계

1. 입력된 이미지 query의 의미와 맥락(이미지 묘사) 파악
2. 의미적으로 연관성이 높은 이미지 키워드 후보를 단계별 논리적으로 도출(내부적 reasoning)
3. semantic vector retrieval에 적합하도록, 이미지 검색을 위한 rewritten_query 자연어 문장 생성
4. 최종 선택된 5~10개 이미지 중심 키워드 및 rewritten_query로 다음과 같이 JSON 객체 반환

# Output Format

반드시 아래 형태의 JSON만 반환할 것:
{
  \"related_keywords\": [\"keyword1\", \"keyword2\", ..., \"keywordN\"],   // 이미지 관련 키워드 5~10개
  \"rewritten_query\": \"변환한 문장\"
}

# Examples

아래 예시처럼, 사용자 입력 query가 한 단어 키워드 형식일 수도 있고(예: '졸려'), 문장이나 긴 요구처럼 입력될 수도 있습니다(예: '졸릴 때 쓰기 좋은 짤').
내부적으로 reasoning 단계를 반드시 선행하여 논리적으로 키워드 및 변환문장을 도출할 것. 아래 결과(JSON) 예시는 reasoning 없이 최종 결과만 보여줍니다.

예시 1(keyword style input):
Input:
졸려

Output:
{
  \"related_keywords\": [
    \"하품\",
    \"졸린\",
    \"피곤\",
    \"침대\",
    \"이불\",
    \"졸음\",
    \"취침\"
  ],
  \"rewritten_query\": \"졸려와 유사한 자막이나 졸려하는 사람이 포함된 문서\"
}"""),
        ],
    )
    
    def _generate():
        result_text = ""
        for chunk in gemini_client.models.generate_content_stream(
            model="gemini-2.5-flash-lite",
            contents=contents,
            config=generate_content_config,
        ):
            result_text += chunk.text
        return result_text
    
    try:
        response_text = await asyncio.to_thread(_generate)
        print(response_text)
        result_data = json.loads(response_text)
        
        return KeywordsResponse(
            related_keywords=result_data.get("related_keywords", []),
            rewritten_query=result_data.get("rewritten_query", search_query.query)
        )
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse JSON response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Keyword generation failed: {str(e)}")

@app.get("/img")
async def get_image(id: str):
    state = load_state()
    for filename, data in state["processed_images"].items():
        if data["image_id"] == id:
            requested_path = (IMAGES_DIR / filename).resolve()
            if not requested_path.is_file():
                raise HTTPException(status_code=404, detail="Image not found")
            response = FileResponse(
                requested_path,
                media_type=f"image/{requested_path.suffix[1:]}",
                filename=requested_path.name,
            )
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
    raise HTTPException(status_code=404, detail="Image not found")


@app.get("/all")
async def get_all_image_ids() -> List[str]:
    state = load_state()
    image_ids = [meta["image_id"] for meta in state.get("processed_images", {}).values()]
    return image_ids

@app.get("/")
async def root():
    state = load_state()
    return f"무~야호! {len(state['processed_images'])}개의 무도짤이 저장되어 있어요."

@app.get("/build")
async def build_dataset():
    if build_lock.locked():
        async def already_running():
            yield b"event: info\n"
            yield b"data: build is already running\n\n"
        return StreamingResponse(already_running(), media_type="text/event-stream")
    
    async def stream_proc():
        async with build_lock:
            cmd = shlex.split(f"python -u {STORE_PY_FILE}")
            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            except Exception as e:
                yield b"event: error\n"
                yield f"data: failed to start process: {e}\n\n".encode()
                return
            
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                yield b"event: stdout\n"
                yield b"data: " + line.rstrip(b"\n") + b"\n\n"
            
            while True:
                err = await proc.stderr.readline()
                if not err:
                    break
                yield b"event: stderr\n"
                yield b"data: " + err.rstrip(b"\n") + b"\n\n"
            
            rc = await proc.wait()
            yield b"event: done\n"
            yield f"data: exit code {rc}\n\n".encode()
    
    return StreamingResponse(stream_proc(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)