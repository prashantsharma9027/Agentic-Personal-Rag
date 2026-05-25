import { NextRequest, NextResponse } from "next/server";
import { vectorStore } from "@/lib/vectorStore";
import { parsePDF } from "@/lib/pdfParser";
import fs from "fs";
import path from "path";

// GET: List all local indexed documents
export async function GET() {
  try {
    const db = vectorStore.getDB();
    return NextResponse.json({ documents: db.documents });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: Upload, parse, and save a new document as a draft
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, content, type } = body;

    if (!name || !content || !type) {
      return NextResponse.json({ error: "Missing required fields (name, content, type)" }, { status: 400 });
    }

    let finalContent = content;

    // Intercept base64 encoded PDF streams
    if (type === "pdf" && content.startsWith("data:application/pdf;base64,")) {
      const base64Data = content.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      finalContent = await parsePDF(buffer);
    }

    const sizeKB = (finalContent.length / 1024).toFixed(1);
    const sizeStr = `${sizeKB} KB`;

    // Save as draft (no immediate embeddings)
    const newDoc = await vectorStore.addParsedDocument(name, finalContent, type, sizeStr);

    return NextResponse.json({ success: true, document: newDoc });
  } catch (e: any) {
    console.error("Document upload failed:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: Remove document and its corresponding vector chunks
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing document id parameter" }, { status: 400 });
    }

    vectorStore.deleteDocument(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Document delete failed:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT/PATCH: Handle document re-indexing on saves or renames
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, content, reindex } = body;

    if (!id || !name || content === undefined) {
      return NextResponse.json({ error: "Missing required fields (id, name, content)" }, { status: 400 });
    }

    const db = vectorStore.getDB();
    const docExists = db.documents.find((d) => d.id === id);

    if (!docExists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // If manual reindex is requested, trigger embedding calculations
    if (reindex) {
      const success = await vectorStore.reindexDocument(id, name, content);
      return NextResponse.json({ success, id, status: "indexed" });
    }

    // Default metadata update (draft save)
    const updatedDocs = db.documents.map((d) => {
      if (d.id === id) {
        return {
          ...d,
          name,
          status: "idle" as const,
          chunksCount: Math.max(1, Math.floor(content.length / 400)),
        };
      }
      return d;
    });

    const DB_PATH = path.join(process.cwd(), "data", "vectors.json");
    db.documents = updatedDocs;
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");

    return NextResponse.json({ success: true, id, status: "idle" });
  } catch (e: any) {
    console.error("Document save/reindex failed:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
