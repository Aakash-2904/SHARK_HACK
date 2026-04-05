"""
ResearchNet — Multi-Agent Backend (Groq Version)
Requires: pip install flask flask-cors duckduckgo-search requests
Get free API key at: https://console.groq.com
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from duckduckgo_search import DDGS
import requests
import json
import re
import os

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

GROQ_API_KEY = "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"   # 👈 paste your key here
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
MODEL        = "llama-3.3-70b-versatile"

@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")

SYSTEM_PROMPTS = {
    "orchestrator": """You are an Orchestrator for a multi-agent research assistant.
Your ONLY job is to analyze the user query and decide which agents to invoke.
Respond with ONLY valid JSON, no markdown, no explanation:
{
  "reasoning": "one sentence explaining routing decision",
  "agents": ["data"]
}
agents must be an array of one or more of: data, paper, article
- data    -> user wants datasets
- paper   -> user wants academic/research papers
- article -> user wants blog posts, tutorials, news, or general articles
Activate multiple agents when the query spans multiple areas.""",

    "data": """You are DataBot, a specialist AI that ONLY recommends datasets.
You will be given a user query AND web search results.
For each dataset provide: Name, URL, what it contains, why it is relevant.
Stick strictly to datasets only. Do not mention papers or articles.""",

    "paper": """You are PaperBot, a specialist AI that ONLY finds academic research papers.
You will be given a user query AND web search results.
List ALL papers you can find in the search results — aim for at least 5 to 10.
For each paper provide: Title, authors, venue/year, 2-3 sentence summary, URL.
Do not skip any paper found in the results.
Stick strictly to academic papers only. Do not mention datasets or articles.""",

    "article": """You are ArticleBot, a specialist AI that ONLY finds blog posts and tutorials.
You will be given a user query AND web search results.
For each article provide: Title, source, what it covers, URL.
Stick strictly to non-academic web content only. Do not mention datasets or papers.""",
}

AGENT_SEARCH_SUFFIX = {
    "data":    "dataset download site:kaggle.com OR site:huggingface.co OR site:archive.ics.uci.edu OR site:data.gov",
    "paper":   "research paper arxiv OR pubmed OR IEEE OR ACM",
    "article": "tutorial blog article guide",
}

def search_web(query, agent_type, max_results=15):
    biased_query = f"{query} {AGENT_SEARCH_SUFFIX.get(agent_type, '')}"
    results = []
    try:
        with DDGS() as ddgs:
            for r in ddgs.text(biased_query, max_results=max_results):
                results.append({
                    "title":   r.get("title", ""),
                    "url":     r.get("href", ""),
                    "snippet": r.get("body", ""),
                })
    except Exception as e:
        print(f"[search] Error: {e}")
    return results

def groq_chat(system, user_message):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type":  "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user_message},
        ],
        "temperature": 0.3,
    }
    resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=60)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()

def parse_orchestrator(raw):
    raw = re.sub(r"```[a-z]*", "", raw).replace("```", "").strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {"reasoning": "Fallback: routing to all agents.", "agents": ["data", "paper", "article"]}

@app.route("/orchestrate", methods=["POST"])
def orchestrate():
    query = request.json.get("query", "").strip()
    if not query:
        return jsonify({"error": "Empty query"}), 400
    try:
        raw = groq_chat(SYSTEM_PROMPTS["orchestrator"], query)
        routing = parse_orchestrator(raw)
        agents = [a for a in routing.get("agents", []) if a in ("data", "paper", "article")]
        if not agents:
            agents = ["data", "paper", "article"]
        routing["agents"] = agents
        return jsonify(routing)
    except Exception as e:
        print(f"[orchestrate] ERROR: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/agent/<agent_type>", methods=["POST"])
def run_agent(agent_type):
    if agent_type not in ("data", "paper", "article"):
        return jsonify({"error": "Unknown agent"}), 404
    query = request.json.get("query", "").strip()
    if not query:
        return jsonify({"error": "Empty query"}), 400
    search_results = search_web(query, agent_type)
    results_text = "\n\n".join(
        f"[{i+1}] {r['title']}\nURL: {r['url']}\nSnippet: {r['snippet']}"
        for i, r in enumerate(search_results)
    ) or "No search results found."
    user_msg = f"User query: {query}\n\nWeb search results:\n{results_text}\n\nProvide your specialist recommendations."
    try:
        answer = groq_chat(SYSTEM_PROMPTS[agent_type], user_msg)
        return jsonify({"result": answer, "sources": search_results})
    except Exception as e:
        print(f"[agent/{agent_type}] ERROR: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    try:
        groq_chat("you are helpful", "say ok")
        return jsonify({"status": "ok", "groq": True, "model": MODEL})
    except Exception as e:
        return jsonify({"status": "error", "groq": False, "error": str(e)})

if __name__ == "__main__":
    print("Starting ResearchNet (Groq) on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000)
