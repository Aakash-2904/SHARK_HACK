import numpy as np
import json
import os
from pinecone import Pinecone

BASE = os.path.dirname(os.path.abspath(__file__))

# PINECONE_API_KEY = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# PINECONE_INDEX   = "quickstart"
pc = Pinecone(api_key="pcsk_7GUD1w_BCB6NfeGM4DmtoJuX2ZivNR5WvvfU7jeGmZiyCAGFQgAwikbU61EifXumAY9LbN")
index = pc.Index("luminary")   # must have dimension=8, metric=cosine
RESEARCHERS = []
 
 
def load_researchers_from_pinecone():
    """
    Loads ALL vectors from Pinecone into the in-memory RESEARCHERS list.
    Called once at startup. Replaces the JSON file entirely.
    """
    global RESEARCHERS
    try:
        # Fetch index stats to know total vector count
        stats = index.describe_index_stats()
        total = stats.get("total_vector_count", 0)
 
        if total == 0:
            print("⚠️  Pinecone index is empty — no researchers loaded")
            RESEARCHERS = []
            return
 
        # List all vector IDs then fetch them in batches
        all_ids = []
        for id_batch in index.list():
            all_ids.extend(id_batch)
 
        # Fetch vectors in batches of 100
        researchers = []
        for i in range(0, len(all_ids), 100):
            batch_ids = all_ids[i:i+100]
            response  = index.fetch(ids=batch_ids)
            for vid, vec in response.vectors.items():
                meta = vec.metadata or {}
                researchers.append(_meta_to_researcher(vid, meta, vec.values))
 
        RESEARCHERS = researchers
        print(f"✅ Loaded {len(RESEARCHERS)} researchers from Pinecone")
 
    except Exception as e:
        print(f"⚠️  Failed to load from Pinecone: {e}")
        RESEARCHERS = []
 
 
def reload_researchers():
    """Re-loads all researchers from Pinecone. Called after every upload."""
    load_researchers_from_pinecone()
 
 
def _meta_to_researcher(vid: str, meta: dict, values: list) -> dict:
    """Converts a Pinecone vector + metadata into a researcher dict."""
    return {
        "id":          vid,
        "name":        meta.get("name", ""),
        "university":  meta.get("university", ""),
        "dept":        meta.get("dept", ""),
        "title":       meta.get("title", ""),
        "abstract":    meta.get("abstract", ""),
        "status":      meta.get("status", "ongoing"),
        "stage":       meta.get("stage", "early"),
        "irb_status":  meta.get("irb_status", "pending"),
        "email":       meta.get("email", ""),
        "methodology": [m.strip() for m in meta.get("methodology", "").split(",") if m.strip()],
        "domain":      [d.strip() for d in meta.get("domain",      "").split(",") if d.strip()],
        "datasets":    [d.strip() for d in meta.get("datasets",    "").split(",") if d.strip()],
        "embedding":   list(values) if values else get_query_embedding(meta.get("abstract", "")).tolist(),
    }
 
 
# ── Embedding ──────────────────────────────────────────────────────────────────
def get_query_embedding(query: str) -> np.ndarray:
    q = query.lower()
    emb = np.array([
        1.0 if any(k in q for k in ["federated", "privacy", "distributed", "secure"]) else 0.1,
        1.0 if any(k in q for k in ["genomic", "omics", "genome", "rare disease", "exome", "rna"]) else 0.1,
        1.0 if any(k in q for k in ["quantum", "qaoa", "qubo", "annealing"]) else 0.1,
        1.0 if any(k in q for k in ["optimization", "drug", "molecular", "protein"]) else 0.1,
        1.0 if any(k in q for k in ["cancer", "tumor", "detection", "medical", "imaging"]) else 0.1,
        1.0 if any(k in q for k in ["nlp", "clinical", "text", "language", "notes", "ehr"]) else 0.1,
        1.0 if any(k in q for k in ["feature", "selection", "high-dimensional", "biomedical"]) else 0.1,
        1.0 if any(k in q for k in ["mri", "ct", "scan", "brain", "neuro", "fmri"]) else 0.1,
    ], dtype=float)
    norm = np.linalg.norm(emb)
    return emb / norm if norm > 0 else emb
 
 
# ── Upsert one researcher to Pinecone ─────────────────────────────────────────
def upsert_researcher_to_pinecone(researcher: dict):
    try:
        index.upsert(vectors=[{
            "id":     researcher["id"],
            "values": researcher["embedding"],
            "metadata": {
                "name":        researcher.get("name", ""),
                "university":  researcher.get("university", ""),
                "dept":        researcher.get("dept", ""),
                "title":       researcher.get("title", ""),
                "abstract":    researcher.get("abstract", ""),
                "status":      researcher.get("status", "ongoing"),
                "stage":       researcher.get("stage", "early"),
                "irb_status":  researcher.get("irb_status", "pending"),
                "email":       researcher.get("email", ""),
                "methodology": ", ".join(researcher.get("methodology", [])),
                "domain":      ", ".join(researcher.get("domain", [])),
                "datasets":    ", ".join(researcher.get("datasets", [])),
            }
        }])
        print(f"✅ Pinecone upsert: {researcher['id']} — {researcher.get('name')}")
    except Exception as e:
        print(f"⚠️  Pinecone upsert failed: {e}")
 
 
# ── Main search ────────────────────────────────────────────────────────────────
def rag_search(query: str, top_k: int = 20) -> list:
    """
    Queries Pinecone directly with the embedding vector.
    Results come entirely from Pinecone — no JSON file involved.
    Falls back to in-memory cache if Pinecone query fails.
    """
    query_emb = get_query_embedding(query).tolist()
 
    try:
        results = index.query(
            vector=query_emb,
            top_k=top_k,
            include_metadata=True
        )
 
        if not results.matches:
            print(f"⚠️  Pinecone returned 0 matches for: '{query}'")
            return []
 
        matched = []
        for match in results.matches:
            meta = match.metadata or {}
            matched.append(_meta_to_researcher(match.id, meta, []))
 
        print(f"✅ Pinecone search: {len(matched)} results for '{query}'")
        return matched
 
    except Exception as e:
        print(f"⚠️  Pinecone query failed: {e} — using in-memory cache")
        return _local_search(query, top_k)
 
 
def _local_search(query: str, top_k: int = 20) -> list:
    """Fallback cosine similarity over in-memory RESEARCHERS cache."""
    if not RESEARCHERS:
        return []
    query_emb = get_query_embedding(query)
    scored = []
    for r in RESEARCHERS:
        r_emb = np.array(r["embedding"], dtype=float)
        norm  = np.linalg.norm(r_emb)
        r_emb = r_emb / norm if norm > 0 else r_emb
        sim   = float(np.dot(query_emb, r_emb))
        scored.append((r, sim))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [r for r, _ in scored[:top_k]]
 