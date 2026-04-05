/**
 * Luminary API client
 */

const BASE_URL = "http://localhost:8000";

/**
 * Search researchers — RAG + FL + QAOA pipeline
 */
export async function searchResearchers({
  query,
  universityFilter = null,
  irbFilter = false,
  statusFilter = null,
}) {
  try {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        university_filter: universityFilter,
        irb_filter: irbFilter,
        status_filter: statusFilter,
        top_k: 20,
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.results;
  } catch (err) {
    console.warn("Backend offline — using local data", err);
    return null;
  }
}

/**
 * Upload researcher metadata as plain JSON.
 * Files are NOT sent — only the description and form fields are saved to Pinecone.
 */
export async function uploadDataset({
  description,
  name,
  university,
  dept        = "",
  email       = "",
  dataTypes   = [],
  irbApproved = false,
  status      = "ongoing",
  stage       = "early",
}) {
  const res = await fetch(`${BASE_URL}/upload/dataset`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      university,
      dept,
      email,
      description,
      data_types:   dataTypes,
      irb_approved: irbApproved,
      status,
      stage,
    }),
  });

  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }

  return res.json();
}

/**
 * Get single researcher profile
 */
export async function getResearcher(id) {
  try {
    const res = await fetch(`${BASE_URL}/researcher/${id}`);
    if (!res.ok) throw new Error(`Not found: ${id}`);
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch researcher", err);
    return null;
  }
}

/**
 * Health check
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}