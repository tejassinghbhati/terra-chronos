import asyncio
import json
import os
import random

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from sim.llm import is_online, parse_llm_json, prompt_llm

app = FastAPI(title="Terra Chronos", version="1.0.0")

FRONTEND_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend")
)

NARRATE_SYSTEM = """You are a historian narrating a documentary \
about human civilization. Your tone is authoritative, precise, \
and slightly dramatic — like David Attenborough narrating human history.
Always write in past tense. Never use bullet points or headers.
Keep responses to exactly 2-3 sentences."""

FORK_SYSTEM = """You are a historian and simulation engine.
Given a user-defined historical event, you generate the plausible \
state of world civilizations 1000 years after that event.
You respond ONLY with valid JSON. No explanation, no markdown, \
no preamble. The JSON must be parseable by Python's json.loads()."""


def _fmt_year(y: int) -> str:
    if y < 0:
        return f"{abs(y)} BCE"
    if y == 0:
        return "1 CE"
    return f"{y} CE"


def _fmt_regions(rs: list) -> str:
    return "; ".join(
        f"{r.get('name', '?')} ({r.get('pop', 0):.0f}M, {r.get('civ_type', '?')})"
        for r in rs
    )


@app.get("/api/health")
async def health():
    online = await asyncio.to_thread(is_online)
    return {"status": "ok", "llm_online": online, "model": "llama3.1"}


@app.post("/api/narrate")
async def narrate(request: Request):
    body = await request.json()
    year = body.get("year", 0)
    prev_year = body.get("prev_year", year - 1000)
    regions = body.get("regions", [])
    prev_regions = body.get("prev_regions", [])

    user_msg = (
        f"Between {_fmt_year(prev_year)} and {_fmt_year(year)}, "
        f"world civilization changed. "
        f"Previous state: {_fmt_regions(prev_regions)}. "
        f"Current state: {_fmt_regions(regions)}. "
        f"Narrate the most significant change in 2-3 sentences."
    )

    try:
        raw = await asyncio.to_thread(prompt_llm, NARRATE_SYSTEM, user_msg)
        if raw.startswith("__FALLBACK__"):
            raise ValueError(raw)
        narration = raw
    except Exception:
        total = sum(r.get("pop", 0) for r in regions)
        narration = (
            f"By {_fmt_year(year)}, the world's population reached "
            f"approximately {total:.0f} million people across "
            f"{len(regions)} major civilizations."
        )

    return {"narration": narration, "year": year}


@app.post("/api/fork")
async def fork(request: Request):
    body = await request.json()
    year = body.get("year", 0)
    current_regions = body.get("current_regions", [])
    user_prompt = body.get("prompt", "")
    next_year = year + 1000

    region_json = json.dumps(
        [
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "pop": r.get("pop"),
                "civ_type": r.get("civ_type"),
            }
            for r in current_regions
        ]
    )

    user_msg = (
        f"It is {_fmt_year(year)}. Current civilizations: {region_json}. "
        f"The following event occurs and its consequences compound "
        f"over the next 1000 years: {user_prompt}. "
        f"Generate the state of civilization in {_fmt_year(next_year)}. "
        f'Respond with JSON only: {{"regions": [{{"id": "string", "name": "string", '
        f'"lat": number, "lng": number, "pop": number, '
        f'"civ_type": "string", "change_reason": "string"}}], '
        f'"world_pop": number, "key_event": "string"}}'
    )

    try:
        raw = await asyncio.to_thread(prompt_llm, FORK_SYSTEM, user_msg, 0.6)
        if raw.startswith("__FALLBACK__"):
            raise ValueError(raw)
        result = parse_llm_json(raw)
        assert "regions" in result and isinstance(result["regions"], list)
    except Exception:
        result = {
            "regions": [
                {
                    **r,
                    "pop": round(r["pop"] * (0.8 + random.random() * 0.4), 1),
                    "change_reason": "Historical momentum continued.",
                }
                for r in current_regions
            ],
            "world_pop": sum(r["pop"] for r in current_regions),
            "key_event": f"The world continued to evolve following {_fmt_year(year)}.",
        }

    return result


@app.post("/api/stats")
async def stats(request: Request):
    body = await request.json()
    regions = body.get("regions", [])
    if not regions:
        return {
            "world_pop": 0,
            "largest_civ": "—",
            "most_common_type": "—",
            "total_regions": 0,
            "collapse_count": 0,
        }

    world_pop = round(sum(r.get("pop", 0) for r in regions), 1)
    largest = max(regions, key=lambda r: r.get("pop", 0))
    types = [r.get("civ_type", "") for r in regions]
    most_common = max(set(types), key=types.count) if types else "—"
    collapse_count = sum(1 for r in regions if r.get("civ_type") == "collapse")
    top3 = sorted(regions, key=lambda r: r.get("pop", 0), reverse=True)[:3]

    return {
        "world_pop": world_pop,
        "largest_civ": largest.get("name", "—"),
        "largest_pop": largest.get("pop", 0),
        "most_common_type": most_common,
        "total_regions": len(regions),
        "collapse_count": collapse_count,
        "top3": [
            {"name": r["name"], "pop": r["pop"], "civ_type": r["civ_type"]}
            for r in top3
        ],
    }


# Static frontend — must be last so API routes take priority
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
