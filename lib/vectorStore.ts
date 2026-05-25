import fs from "fs";
import path from "path";

export interface VectorChunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  embedding: number[];
}

export interface DocumentMeta {
  id: string;
  name: string;
  type: "pdf" | "md" | "txt";
  size: string;
  chunksCount: number;
  status: "indexed" | "indexing" | "idle";
  createdAt: string;
  content: string;
}

export interface VectorDB {
  documents: DocumentMeta[];
  chunks: VectorChunk[];
}

const DB_PATH = path.join(process.cwd(), "data", "vectors.json");

// Ensure DB file and directory exist
function initDB(): VectorDB {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const defaultData: VectorDB = { documents: [], chunks: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), "utf-8");
    return defaultData;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    const defaultData: VectorDB = { documents: [], chunks: [] };
    return defaultData;
  }
}

// Write database to local file
function saveDB(db: VectorDB) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// Smart recursive text splitter
export function splitText(text: string, chunkSize = 600, overlap = 100): string[] {
  const chunks: string[] = [];
  let index = 0;

  // Split by double newlines (paragraphs) first to maintain structured thoughts
  const paragraphs = text.split("\n\n");

  let currentChunk = "";
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= chunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk);

      // If a single paragraph is too large, split it by sentences or characters
      if (paragraph.length > chunkSize) {
        let subIndex = 0;
        while (subIndex < paragraph.length) {
          const endIdx = Math.min(subIndex + chunkSize, paragraph.length);
          chunks.push(paragraph.slice(subIndex, endIdx));
          subIndex += chunkSize - overlap;
        }
        currentChunk = "";
      } else {
        currentChunk = paragraph;
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Fetch real embeddings from Google Gemini text-embedding-004
export async function getEmbedding(prompt: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-001:embedContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text: prompt }] },
            embedContentConfig: {
              output_dimensionality: 768
            }
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.embedding?.values?.length) {
          return data.embedding.values as number[];
        }
      } else {
        const errorText = await response.text();
        console.error(`[Gemini Embeddings Error] HTTP ${response.status}:`, errorText);
      }
    } catch (err: any) {
      console.error("[Gemini Embeddings Fetch Exception]:", err.message || err);
    }
  }

  // Deterministic mock fallback (768-dim) when API is unavailable
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = (hash << 5) - hash + prompt.charCodeAt(i);
    hash |= 0;
  }
  return Array.from({ length: 768 }, (_, i) => {
    const v = Math.sin(hash + i) * 10000;
    return v - Math.floor(v) - 0.5;
  });
}

// Cosine Similarity Math: A • B / (||A|| * ||B||)
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0.0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Core DB operations exporter
export const vectorStore = {
  getDB: (): VectorDB => {
    return initDB();
  },

  addParsedDocument: async (
    name: string,
    content: string,
    type: "pdf" | "md" | "txt",
    size: string
  ): Promise<DocumentMeta> => {
    const db = initDB();
    const docId = `doc-${Date.now()}`;

    const newDoc: DocumentMeta = {
      id: docId,
      name,
      type,
      size,
      chunksCount: 0,
      status: "idle",
      createdAt: new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      content,
    };

    db.documents.push(newDoc);
    saveDB(db);

    return newDoc;
  },

  addDocument: async (
    name: string,
    content: string,
    type: "pdf" | "md" | "txt",
    size: string
  ): Promise<DocumentMeta> => {
    const db = initDB();
    const docId = `doc-${Date.now()}`;

    // 1. Recursive chunking
    const textChunks = splitText(content);

    const newDoc: DocumentMeta = {
      id: docId,
      name,
      type,
      size,
      chunksCount: textChunks.length,
      status: "indexing",
      createdAt: new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      content,
    };

    // Store doc metadata immediately as 'indexing'
    db.documents.push(newDoc);
    saveDB(db);

    // Perform vector conversions in background/synchronously
    const chunkPromises = textChunks.map(async (text, idx) => {
      const embedding = await getEmbedding(text);
      return {
        id: `chunk-${docId}-${idx}`,
        docId,
        docName: name,
        text,
        embedding,
      };
    });

    try {
      const vectorChunks = await Promise.all(chunkPromises);
      
      // Load fresh DB state before appending
      const currentDB = initDB();
      currentDB.chunks = [...currentDB.chunks, ...vectorChunks];
      
      // Mark document status as 'indexed'
      currentDB.documents = currentDB.documents.map((d) =>
        d.id === docId ? { ...d, status: "indexed" as const } : d
      );
      
      saveDB(currentDB);
      newDoc.status = "indexed";
      return newDoc;
    } catch (err) {
      // Graceful fallback to idle
      const currentDB = initDB();
      currentDB.documents = currentDB.documents.map((d) =>
        d.id === docId ? { ...d, status: "idle" as const } : d
      );
      saveDB(currentDB);
      newDoc.status = "idle";
      return newDoc;
    }
  },

  deleteDocument: (id: string) => {
    const db = initDB();
    db.documents = db.documents.filter((d) => d.id !== id);
    db.chunks = db.chunks.filter((c) => c.docId !== id);
    saveDB(db);
  },

  reindexDocument: async (id: string, name: string, content: string): Promise<boolean> => {
    // Clean old chunks
    const db = initDB();
    db.chunks = db.chunks.filter((c) => c.docId !== id);
    db.documents = db.documents.map((d) => (d.id === id ? { ...d, status: "indexing" as const } : d));
    saveDB(db);

    const textChunks = splitText(content);

    try {
      const chunkPromises = textChunks.map(async (text, idx) => {
        const embedding = await getEmbedding(text);
        return {
          id: `chunk-${id}-${idx}`,
          docId: id,
          docName: name,
          text,
          embedding,
        };
      });

      const vectorChunks = await Promise.all(chunkPromises);

      const currentDB = initDB();
      currentDB.chunks = [...currentDB.chunks, ...vectorChunks];
      currentDB.documents = currentDB.documents.map((d) =>
        d.id === id ? { ...d, status: "indexed" as const, content, chunksCount: textChunks.length } : d
      );
      saveDB(currentDB);
      return true;
    } catch (err) {
      const currentDB = initDB();
      currentDB.documents = currentDB.documents.map((d) => (d.id === id ? { ...d, status: "idle" as const } : d));
      saveDB(currentDB);
      return false;
    }
  },

  similaritySearch: async (query: string, limit = 4, docIdConstraint: string | null = null): Promise<VectorChunk[]> => {
    const db = initDB();
    if (db.chunks.length === 0) return [];

    // Calculate embedding for query
    const queryVector = await getEmbedding(query);

    // Filter chunks by document constraints if applicable
    let targetChunks = db.chunks;
    if (docIdConstraint) {
      targetChunks = db.chunks.filter((c) => c.docId === docIdConstraint);
    }

    // Map through vectors and calculate similarity
    const scoredChunks = targetChunks.map((chunk) => {
      const score = cosineSimilarity(queryVector, chunk.embedding);
      return { chunk, score };
    });

    // Sort by descending similarity score
    scoredChunks.sort((a, b) => b.score - a.score);

    // Return the top-k chunks with high score
    return scoredChunks.slice(0, limit).map((sc) => sc.chunk);
  },
};
