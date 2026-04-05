"""
fl_data.py — Luminary
Converts researcher data into FL training data.
Generates all researcher pairs with QAOA-derived collaboration labels.
Each university becomes one federated client node.

UPDATED: Reads researchers from the rag module (Pinecone) instead of JSON file.
"""

import numpy as np
import pandas as pd
import itertools

# ── Stage complementarity matrix ──
STAGE_MATRIX = {
    ("early","mid"):0.90, ("early","published"):0.95,
    ("early","early"):0.60, ("mid","published"):0.85,
    ("mid","mid"):0.70, ("published","published"):0.40,
    ("dataset_available","early"):1.00,
    ("dataset_available","mid"):0.90,
    ("dataset_available","published"):0.70,
    ("early","dataset_available"):1.00,
    ("mid","dataset_available"):0.90,
}


def methodology_overlap(a, b):
    sa = set(m.lower() for m in a.get("methodology", []))
    sb = set(m.lower() for m in b.get("methodology", []))
    if not sa or not sb:
        return 0.0
    inter = sa & sb
    union = sa | sb
    base = len(inter) / len(union)
    rare = {"federated learning","quantum computing","qaoa",
            "split learning","differential privacy","secure aggregation"}
    bonus = 0.15 if inter & rare else 0.0
    return min(base + bonus, 1.0)


def domain_proximity(a, b):
    ea = np.array(a.get("embedding", [0.5]*8), dtype=float)
    eb = np.array(b.get("embedding", [0.5]*8), dtype=float)
    # Pad or trim to 8 dimensions
    if len(ea) != 8:
        ea = np.pad(ea, (0, max(0, 8-len(ea))))[:8]
    if len(eb) != 8:
        eb = np.pad(eb, (0, max(0, 8-len(eb))))[:8]
    ea = ea / (np.linalg.norm(ea) or 1)
    eb = eb / (np.linalg.norm(eb) or 1)
    return float(np.dot(ea, eb) / (np.linalg.norm(ea) * np.linalg.norm(eb) or 1))


def dataset_compat(a, b):
    ia, ib = a.get("irb_status",""), b.get("irb_status","")
    if ia == "pending" or ib == "pending":
        return 0.1
    if ia in ["approved","not_required"] and ib in ["approved","not_required"]:
        wa = set(" ".join(a.get("datasets",[])).lower().split())
        wb = set(" ".join(b.get("datasets",[])).lower().split())
        ov = len(wa & wb) / max(len(wa | wb), 1)
        return min(0.5 + ov * 0.5, 1.0)
    return 0.3


def stage_compat(a, b):
    sa, sb = a.get("stage","early"), b.get("stage","early")
    return STAGE_MATRIX.get((sa,sb), STAGE_MATRIX.get((sb,sa), 0.5))


def compute_qaoa_label(a, b):
    m  = methodology_overlap(a, b)
    d  = domain_proximity(a, b)
    ds = dataset_compat(a, b)
    s  = stage_compat(a, b)
    score = 0.35*m + 0.30*d + 0.20*ds + 0.15*s
    if m > 0.75 and d > 0.85:
        score *= 0.70
    score = 0.5 + (score * 0.6)
    return round(min(score, 0.97), 4)


def build_feature_row(a, b):
    m  = methodology_overlap(a, b)
    d  = domain_proximity(a, b)
    ds = dataset_compat(a, b)
    s  = stage_compat(a, b)

    ea = np.array(a.get("embedding", [0.5]*8), dtype=float)
    eb = np.array(b.get("embedding", [0.5]*8), dtype=float)
    # Ensure 8 dimensions
    if len(ea) != 8:
        ea = np.pad(ea, (0, max(0, 8-len(ea))))[:8]
    if len(eb) != 8:
        eb = np.pad(eb, (0, max(0, 8-len(eb))))[:8]
    ea = ea / (np.linalg.norm(ea) or 1)
    eb = eb / (np.linalg.norm(eb) or 1)

    irb_a = 1.0 if a.get("irb_status") == "approved" else 0.0
    irb_b = 1.0 if b.get("irb_status") == "approved" else 0.0

    stage_map = {"early":0,"mid":1,"published":2,"dataset_available":3}
    sa = stage_map.get(a.get("stage","early"), 0) / 3.0
    sb = stage_map.get(b.get("stage","early"), 0) / 3.0

    return {
        "methodology_overlap":   m,
        "domain_proximity":      d,
        "dataset_compatibility": ds,
        "stage_complementarity": s,
        "a_emb_0": ea[0], "a_emb_1": ea[1], "a_emb_2": ea[2], "a_emb_3": ea[3],
        "a_emb_4": ea[4], "a_emb_5": ea[5], "a_emb_6": ea[6], "a_emb_7": ea[7],
        "b_emb_0": eb[0], "b_emb_1": eb[1], "b_emb_2": eb[2], "b_emb_3": eb[3],
        "b_emb_4": eb[4], "b_emb_5": eb[5], "b_emb_6": eb[6], "b_emb_7": eb[7],
        "irb_a": irb_a,
        "irb_b": irb_b,
        "stage_a": sa,
        "stage_b": sb,
        "university_a": a.get("university",""),
        "university_b": b.get("university",""),
        "collab_score": compute_qaoa_label(a, b),
        "id_a": a.get("id", "query"),        
        "id_b": b.get("id", "unknown"),
    }


def generate_training_data(researchers=None):
    """
    Generate all pairwise combinations of researchers.
    Accepts researchers list directly (from Pinecone) instead of reading JSON.
    Falls back to importing from rag if not provided.
    """
    if researchers is None:
        # Import here to avoid circular imports at module load time
        from rag import RESEARCHERS as _R
        researchers = _R

    if len(researchers) < 2:
        print("⚠️  Not enough researchers for FL training — need at least 2")
        # Return empty DataFrame with correct columns
        return pd.DataFrame(columns=FEATURE_COLS + ["collab_score", "id_a", "id_b",
                                                      "university_a", "university_b"])

    rows = []
    for a, b in itertools.combinations(researchers, 2):
        rows.append(build_feature_row(a, b))
        rows.append(build_feature_row(b, a))

    df = pd.DataFrame(rows)
    print(f"✅ FL training data: {len(df)} pairs from {len(researchers)} researchers")
    return df


def split_by_university(df):
    universities = df["university_a"].unique()
    clients = {}
    for uni in universities:
        client_df = df[df["university_a"] == uni]
        clients[uni] = client_df
        print(f"  Node [{uni}]: {len(client_df)} training pairs")
    return clients


FEATURE_COLS = [
    "methodology_overlap", "domain_proximity",
    "dataset_compatibility", "stage_complementarity",
    "a_emb_0","a_emb_1","a_emb_2","a_emb_3",
    "a_emb_4","a_emb_5","a_emb_6","a_emb_7",
    "b_emb_0","b_emb_1","b_emb_2","b_emb_3",
    "b_emb_4","b_emb_5","b_emb_6","b_emb_7",
    "irb_a","irb_b","stage_a","stage_b",
]
TARGET_COL = "collab_score"