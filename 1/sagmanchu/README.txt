Sagmanchu | interfaz integrada + voice assistant

1. pip install -r requirements.txt
2. Ollama running with the model llama3.2:1b  (ollama pull llama3.2:1b)
3. Copy your logo.png and jocarsa.png into this folder (next to index.html)
4. python server.py
5. Open http://localhost:8000 in Chrome or Edge, click "Assistant", turn the mic on,
   then say "assistant ..." (say "stop" to silence it)

Edit train.jsonl to add quick answers: {"event": "...", "reaction": "..."}
