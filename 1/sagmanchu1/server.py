"""
Sagmanchu | interfaz integrada  +  Voice assistant (backend)

Replaces the old app.py loop. The browser now does the listening (wake word,
"stop") and the playback; this server does what only Python can do:
  - serve the interface (index.html, css/, js/, data/ ...)
  - POST /api/chat  -> train.jsonl quick reactions first, Ollama as fallback
  - POST /api/tts   -> edge-tts voice (same voice as app.py), returns mp3
Run:  python server.py   ->  http://localhost:8000
"""
import asyncio
import json
import os
import threading
from datetime import datetime

import edge_tts
import ollama
from flask import Flask, Response, abort, jsonify, request, send_from_directory

BASE = os.path.dirname(os.path.abspath(__file__))

# --- Configuration (same as app.py) ---
VOICE = "en-US-GuyNeural"  # voz por defecto
VOICES = {  # voz edge-tts por idioma del selector del asistente
    "en-US": "en-US-GuyNeural",
    "es-ES": "es-ES-AlvaroNeural",
    "ru-RU": "ru-RU-DmitryNeural",
}
MODEL = "llama3.2:1b"
TRAIN_FILE = os.path.join(BASE, "train.jsonl")
LOG_FILE = os.path.join(BASE, "logs", "chat_log.json")  # not web-accessible

app = Flask(__name__, static_folder=None)
log_lock = threading.Lock()

# Only these are served to the browser (keeps train.jsonl, logs, server.py private)
PUBLIC_DIRS = {"css", "js", "data", "natural-ui"}
PUBLIC_ROOT_EXT = {".html", ".png", ".svg", ".ico"}


# ---------------------------------------------------------------- knowledge
def load_local_knowledge():
    """Quick preset reactions from train.jsonl ({"event": ..., "reaction": ...})."""
    knowledge = []
    if not os.path.exists(TRAIN_FILE):
        return knowledge
    try:
        with open(TRAIN_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    knowledge.append(json.loads(line))
    except Exception as e:
        print(f"Error loading {TRAIN_FILE}: {e}")
    return knowledge


def get_local_response(user_text, knowledge_base):
    user_text_lower = user_text.lower()
    for item in knowledge_base:
        trigger = item.get("event", "").lower().strip()
        if not trigger:  # an empty trigger would match everything
            continue
        if trigger in user_text_lower or user_text_lower in trigger:
            return item.get("reaction")
    return None


def get_ai_response(user_text):
    try:
        response = ollama.chat(
            model=MODEL, messages=[{"role": "user", "content": user_text}]
        )
        return response["message"]["content"]
    except Exception as e:
        return f"Ollama Error: {e}"


def log_interaction(user_input, assistant_output, source):
    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": source,
        "user": user_input,
        "assistant": assistant_output,
    }
    with log_lock:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        logs = []
        if os.path.exists(LOG_FILE):
            try:
                with open(LOG_FILE, "r", encoding="utf-8") as f:
                    logs = json.load(f)
            except Exception:
                logs = []
        logs.append(entry)
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=4)


# ---------------------------------------------------------------------- API
@app.post("/api/chat")
def api_chat():
    text = (request.get_json(silent=True) or {}).get("text", "").strip()
    if not text:
        return jsonify(error="empty text"), 400

    answer = get_local_response(text, load_local_knowledge())
    source = "jsonl"
    if not answer:
        answer = get_ai_response(text)
        source = "ollama"

    log_interaction(text, answer, source)
    return jsonify(answer=answer, source=source)


async def _synthesize(text, voice):
    data = b""
    async for chunk in edge_tts.Communicate(text, voice).stream():
        if chunk["type"] == "audio":
            data += chunk["data"]
    return data


@app.post("/api/tts")
def api_tts():
    body = request.get_json(silent=True) or {}
    text = body.get("text", "").strip()
    if not text:
        return jsonify(error="empty text"), 400
    voice = VOICES.get(body.get("lang"), VOICE)
    try:
        audio = asyncio.run(_synthesize(text, voice))
    except Exception as e:
        return jsonify(error=str(e)), 502
    return Response(audio, mimetype="audio/mpeg")


# ------------------------------------------------------------- static files
@app.get("/")
def home():
    return send_from_directory(BASE, "index.html")


@app.get("/<path:path>")
def static_files(path):
    if path.endswith("/"):  # /natural-ui/ -> /natural-ui/index.html
        path += "index.html"
    parts = path.split("/")
    if len(parts) == 1:
        if os.path.splitext(path)[1].lower() not in PUBLIC_ROOT_EXT:
            abort(404)
    elif parts[0] not in PUBLIC_DIRS:
        abort(404)
    return send_from_directory(BASE, path)


if __name__ == "__main__":
    print(f"Loaded {len(load_local_knowledge())} quick reactions from {TRAIN_FILE}.")
    print("Open http://localhost:8000  (use Chrome or Edge for voice)")
    app.run(host="127.0.0.1", port=8000, threaded=True)
