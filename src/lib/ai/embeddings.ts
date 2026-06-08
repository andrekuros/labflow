/**
 * Local, dependency-free embeddings used when no LLM provider is configured.
 * A hashed bag-of-words projected into a fixed-dimension, L2-normalized vector.
 * Good enough for lab-scale semantic search; swap for provider embeddings by
 * setting AI_PROVIDER + AI_API_KEY.
 */

export const LOCAL_DIM = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function hash(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function localEmbed(text: string): number[] {
  const vec = new Array(LOCAL_DIM).fill(0);
  for (const token of tokenize(text)) {
    vec[hash(token) % LOCAL_DIM] += 1;
  }
  return l2normalize(vec);
}

export function l2normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function chunkText(text: string, size = 600, overlap = 100): string[] {
  const clean = text.trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    chunks.push(clean.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}
