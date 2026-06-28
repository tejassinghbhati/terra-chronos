import httpx
import json

OLLAMA_BASE = "http://localhost:11434/api"
MODEL = "llama3.1"


def prompt_llm(system: str, user: str, temperature: float = 0.7) -> str:
    try:
        resp = httpx.post(
            f"{OLLAMA_BASE}/chat",
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "stream": False,
                "options": {"temperature": temperature},
            },
            timeout=45.0,
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"].strip()
    except Exception as e:
        return f"__FALLBACK__: {str(e)}"


def is_online() -> bool:
    try:
        r = httpx.get(f"{OLLAMA_BASE}/tags", timeout=3.0)
        return r.status_code == 200
    except Exception:
        return False


def parse_llm_json(raw: str) -> dict:
    clean = raw.strip()
    for prefix in ["```json", "```"]:
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
    if clean.endswith("```"):
        clean = clean[:-3]
    return json.loads(clean.strip())
