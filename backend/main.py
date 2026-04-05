"""
Luminary — FastAPI Backend
Run: python -m uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uuid

from rag import (
    rag_search, get_query_embedding, RESEARCHERS,
    reload_researchers, upsert_researcher_to_pinecone,
    load_researchers_from_pinecone,
)
from qaoa import qaoa_rank, query_to_profile
from federated import run_federated_round, encrypt_all_researchers
from fl_model import get_fl_model

app = FastAPI(title="Luminary API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

federated_state       = {}
encrypted_researchers = []
fl_model              = None


@app.on_event("startup")
async def startup():
    global federated_state, encrypted_researchers, fl_model
    print("\n" + "="*65)
    print("  LUMINARY STARTUP PIPELINE")
    print("="*65)

    print("\n🔄 Step 1: Loading researchers from Pinecone...")
    load_researchers_from_pinecone()
    from rag import RESEARCHERS as _R
    print(f"✅ {len(_R)} researchers loaded from Pinecone")
    federated_state       = run_federated_round(_R)
    encrypted_researchers = encrypt_all_researchers(_R)
    print(f"✅ {len(RESEARCHERS)} researchers loaded")

    print("\n🔄 Step 2: Running federated learning round...")
    federated_state       = run_federated_round(RESEARCHERS)
    encrypted_researchers = encrypt_all_researchers(RESEARCHERS)
    print(f"✅ Federated round complete")

    print("\n🔄 Step 3: Training FL models...")
    from rag import RESEARCHERS as _R2
    fl_model = get_fl_model()
    fl_model.train(_R2)    
    print(f"✅ FL models trained")

    print("\n✅ Luminary ready — Pinecone + FL + QAOA active\n")


class SearchRequest(BaseModel):
    query: str
    university_filter: Optional[str] = None
    irb_filter:        Optional[bool] = None
    status_filter:     Optional[str]  = None
    top_k:             Optional[int]  = 20


class UploadRequest(BaseModel):
    name:         str
    university:   str
    dept:         Optional[str]       = ""
    email:        Optional[str]       = ""
    description:  str
    data_types:   Optional[List[str]] = []
    irb_approved: Optional[bool]      = False
    status:       Optional[str]       = "ongoing"
    stage:        Optional[str]       = "early"


@app.get("/")
def root():
    return {"name": "Luminary API", "version": "2.0.0", "status": "running", "total_researchers": len(RESEARCHERS)}


@app.post("/search")
def search(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    rag_results = rag_search(req.query, top_k=req.top_k or 20)

    filtered = rag_results
    if req.university_filter and req.university_filter != "All Universities":
        filtered = [r for r in filtered if req.university_filter.lower() in r["university"].lower()]
    if req.irb_filter:
        filtered = [r for r in filtered if r.get("irb_status") == "approved"]
    if req.status_filter and req.status_filter != "all":
        filtered = [r for r in filtered if r.get("status") == req.status_filter]

    if not filtered:
        return {"query": req.query, "total": 0, "results": []}

    query_emb     = get_query_embedding(req.query).tolist()
    query_profile = query_to_profile(req.query, query_emb)
    ranked        = qaoa_rank(query_profile, filtered, fl_model=fl_model)

    for r in ranked:
        r["embedding_status"] = "encrypted"
        r["pipeline"]         = "Pinecone + FL + QAOA"
        r["fl_informed"]      = r.get("breakdown", {}).get("fl_informed", False)

    return {"query": req.query, "total": len(ranked), "pipeline": "Pinecone → FL → QAOA", "results": ranked}


def _detect_methodology(desc):
    d = desc.lower()
    rules = [
        (["federated learning", "federated"], "Federated Learning"),
        (["quantum", "qaoa", "qubo"],         "Quantum Computing"),
        (["transformer", "bert", "gpt"],      "Transformer"),
        (["cnn", "convolutional"],            "CNN"),
        (["graph neural", "gnn"],             "Graph Neural Network"),
        (["diffusion"],                       "Diffusion Model"),
        (["nlp", "natural language"],         "NLP"),
        (["differential privacy"],            "Differential Privacy"),
        (["deep learning", "neural network"], "Deep Learning"),
        (["transfer learning"],               "Transfer Learning"),
        (["segmentation", "object detection"],"Computer Vision"),
        (["statistical", "regression"],       "Statistical Analysis"),
    ]
    found = [label for kws, label in rules if any(kw in d for kw in kws)]
    return found if found else ["Machine Learning"]


def _detect_domain(desc):
    d = desc.lower()
    rules = [
        (["genomic", "genome", "exome", "dna", "rna"],  "Genomics"),
        (["rare disease", "orphan"],                     "Rare Disease"),
        (["multi-omics", "proteomics"],                  "Multi-Omics"),
        (["cancer", "tumor", "oncology"],                "Cancer"),
        (["mri", "fmri", "ct scan", "radiology"],        "Medical Imaging"),
        (["clinical note", "ehr"],                       "Clinical NLP"),
        (["drug discovery", "molecular"],                "Drug Discovery"),
        (["bioinformatics", "sequence"],                 "Bioinformatics"),
        (["neuroscience", "brain", "eeg"],               "Neuroscience"),
        (["privacy", "security"],                       "Privacy"),
        (["healthcare", "hospital", "patient"],         "Healthcare"),
        (["x-ray", "ultrasound", "pathology"],          "Medical Imaging"),
    ]
    found = [label for kws, label in rules if any(kw in d for kw in kws)]
    return found if found else ["Biomedical"]


@app.post("/upload/dataset")
def upload_dataset(req: UploadRequest):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")
    if not req.university.strip():
        raise HTTPException(status_code=400, detail="University is required.")
    if len(req.description.strip()) < 30:
        raise HTTPException(status_code=400, detail="Description must be at least 30 characters.")

    status    = req.status if req.status in {"ongoing","published","dataset_available"} else "ongoing"
    stage     = req.stage  if req.stage  in {"early","mid","published","dataset_available"} else "early"
    embedding = get_query_embedding(req.description).tolist()
    title     = req.description.strip().split(".")[0].strip()[:120]

    new_researcher = {
        "id":          str(uuid.uuid4())[:8],
        "name":        req.name.strip(),
        "university":  req.university.strip(),
        "dept":        req.dept.strip() if req.dept else "Research Department",
        "title":       title,
        "status":      status,
        "stage":       stage,
        "irb_status":  "approved" if req.irb_approved else "pending",
        "methodology": _detect_methodology(req.description),
        "domain":      _detect_domain(req.description),
        "datasets":    req.data_types if req.data_types else ["Research Dataset"],
        "abstract":    req.description.strip(),
        "email":       req.email.strip() if req.email else "",
        "embedding":   embedding,
    }

    upsert_researcher_to_pinecone(new_researcher)
    reload_researchers()

    print(f"✅ Uploaded to Pinecone: {req.name} | id={new_researcher['id']}")
    return {"success": True, "researcher": new_researcher, "message": f"'{req.name}' added to Pinecone. Searchable immediately."}


@app.get("/fl/summary")
def fl_summary():
    if not fl_model or not fl_model.trained:
        return {"status": "not trained"}
    return {"status": "trained", "models": fl_model.summary, "pipeline": "FL 40% + QAOA 60%"}


@app.get("/federated/status")
def federated_status():
    return {"status": "active", "round": federated_state.get("round", 1), "nodes": federated_state.get("nodes", []), "global_model": federated_state.get("global_model", {})}


@app.get("/researcher/{researcher_id}")
def get_researcher(researcher_id: str):
    for r in encrypted_researchers:
        if r["id"] == researcher_id:
            safe = {k: v for k, v in r.items() if k != "embedding"}
            safe["embedding_status"] = "encrypted"
            return safe
    raise HTTPException(status_code=404, detail="Researcher not found")


@app.get("/researchers")
def get_all():
    return {"researchers": RESEARCHERS, "total": len(RESEARCHERS)}


@app.get("/health")
def health():
    return {"status": "ok", "researchers": len(RESEARCHERS), "storage": "Pinecone"}
