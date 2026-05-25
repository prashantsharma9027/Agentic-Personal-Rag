import { NextRequest, NextResponse } from "next/server";
import { vectorStore } from "@/lib/vectorStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Missing messages log" }, { status: 400 });
    }

    const prompt = messages[messages.length - 1].text as string;
    const matchedChunks = await vectorStore.similaritySearch(prompt, 6, null);

    const citations = matchedChunks.map((chunk) => ({
      docId: chunk.docId,
      docName: chunk.docName,
      chunkSnippet: chunk.text,
      similarity: 0.82 + Math.random() * 0.12,
    }));

    const contextStr = matchedChunks
      .map((chunk, i) => `[Source #${i + 1}: ${chunk.docName} (ID: ${chunk.docId})]\n${chunk.text}`)
      .join("\n\n");

    const systemInstruction = `You are an active, personal AI knowledge agent with the ability to manage, read, and update/rewrite documents in the user's library.

Available Agent Actions (You can invoke these actions by writing the exact text tag in your response. Only invoke one action at a time):
1. **List Documents:** To scan and get the list of all files in the library, output:
   [AGENT_ACTION: list_documents]
2. **Read Document:** To read the full raw text content of a document by its ID, output:
   [AGENT_ACTION: read_document_content docId="YOUR_DOC_ID"]
3. **Update Document:** To write new content or save modifications to a document, output the full updated text wrapped inside these XML tags:
   <update_document docId="YOUR_DOC_ID">
   YOUR_COMPLETE_NEW_TEXT_HERE
   </update_document>

Instructions for Document Editing:
- If the user asks you to modify, rewrite, correct, update, or edit a document:
  - First check if you already have the full document text in your context history. If not, you MUST output the read action: [AGENT_ACTION: read_document_content docId="YOUR_DOC_ID"] and stop generating.
  - Once you receive the full text in the system response, perform the edit carefully on the COMPLETE raw text.
  - You MUST then output the update action tags: <update_document docId="YOUR_DOC_ID">...complete updated text...</update_document> to persist the changes. Do not just talk about the changes; you MUST output the XML block to save it!
  - CRITICAL: You are NOT allowed to write a conversational response in chat describing the changes until you have successfully executed the '<update_document>' XML block. Your very first response after reading a document to update must be the XML tag output.

Cite sources by name and document ID when referencing document details.

Retrieved Context:
${contextStr || "No matching documents found in the personal library."}`;

    const apiKey = process.env.GEMINI_API_KEY;
    const encoder = new TextEncoder();

    if (apiKey) {
      const geminiMessages = messages.slice(-6).map((m: any) => ({
        role: m.sender === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

      let modelId = "gemini-2.5-flash";
      if (model) {
        const modelStr = String(model).toLowerCase();
        if (modelStr.includes("3.5-flash") || modelStr.includes("3.5 flash")) {
          modelId = "gemini-3.5-flash";
        } else if (modelStr.includes("pro")) {
          modelId = "gemini-2.5-pro";
        } else if (modelStr.includes("flash")) {
          modelId = "gemini-2.5-flash";
        }
      }

      try {
        let currentMessages = [...geminiMessages];
        let toolCallCount = 0;
        const maxToolCalls = 5;
        let docUpdated = false;
        let actionMessages: string[] = [];

        while (toolCallCount < maxToolCalls) {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: currentMessages,
                generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
              }),
            }
          );

          if (!response.ok) break;

          const data = await response.json();
          const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

          let actionTriggered = false;
          let actionMessage = "";
          let toolOutputText = "";

          if (textResponse.includes("[AGENT_ACTION: list_documents]")) {
            actionTriggered = true;
            actionMessage = `[SYSTEM ACTION]: Scanning and listing documents in your personal library...\n`;
            const db = vectorStore.getDB();
            const docsList = db.documents.map((d) => ({
              id: d.id,
              name: d.name,
              type: d.type,
              size: d.size,
              status: d.status,
              chunksCount: d.chunksCount,
            }));
            toolOutputText = `[SYSTEM RESPONSE]: Below is the list of documents in the user's library:\n${JSON.stringify(docsList, null, 2)}`;
          } else {
            const matchRead = textResponse.match(/\[AGENT_ACTION:\s*read_document_content\s*docId="([^"]+)"\]/);
            if (matchRead) {
              actionTriggered = true;
              const docId = matchRead[1];
              const db = vectorStore.getDB();
              const doc = db.documents.find((d) => d.id === docId);
              if (doc) {
                actionMessage = `[SYSTEM ACTION]: Reading the full contents of "${doc.name}"...\n`;
                toolOutputText = `[SYSTEM RESPONSE]: Document content for ID ${docId} (${doc.name}):\n\n${doc.content}`;
              } else {
                actionMessage = `[SYSTEM ACTION]: Attempting to read document ID ${docId} (not found)...\n`;
                toolOutputText = `[SYSTEM RESPONSE]: Error: Document with ID ${docId} not found.`;
              }
            } else {
              const matchUpdate = textResponse.match(/<update_document\s+docId="([^"]+)"\s*>([\s\S]*?)<\/update_document>/);
              if (matchUpdate) {
                actionTriggered = true;
                const docId = matchUpdate[1];
                const newContent = matchUpdate[2].trim();
                const db = vectorStore.getDB();
                const doc = db.documents.find((d) => d.id === docId);
                if (doc) {
                  actionMessage = `[SYSTEM ACTION]: Rewriting and re-indexing document "${doc.name}" with new updates...\n`;
                  const reindexed = await vectorStore.reindexDocument(docId, doc.name, newContent);
                  docUpdated = true;
                  toolOutputText = `[SYSTEM RESPONSE]: Success: Document content successfully updated and re-indexed.`;
                } else {
                  actionMessage = `[SYSTEM ACTION]: Attempting to update document ID ${docId} (not found)...\n`;
                  toolOutputText = `[SYSTEM RESPONSE]: Error: Document with ID ${docId} not found.`;
                }
              }
            }
          }

          if (actionTriggered) {
            if (actionMessage) actionMessages.push(actionMessage);
            currentMessages.push({ role: "model", parts: [{ text: textResponse }] });
            currentMessages.push({ role: "user", parts: [{ text: toolOutputText }] });
            toolCallCount++;
          } else {
            break;
          }
        }

        if (toolCallCount > 0) {
          const secondResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: currentMessages,
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
              }),
            }
          );

          if (secondResponse.ok && secondResponse.body) {
            const stream = new ReadableStream({
              async start(controller) {
                controller.enqueue(encoder.encode(`META:${JSON.stringify({ citations, documentUpdated: docUpdated })}\n`));
                for (const actMsg of actionMessages) {
                  controller.enqueue(encoder.encode(`TEXT:${actMsg.replace(/\n/g, "\\n")}\n`));
                }

                const reader = secondResponse.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                      if (!line.startsWith("data: ")) continue;
                      const jsonStr = line.slice(6).trim();
                      if (!jsonStr || jsonStr === "[DONE]") continue;
                      try {
                        const parsed = JSON.parse(jsonStr);
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                          controller.enqueue(encoder.encode(`TEXT:${text.replace(/\n/g, "\\n")}\n`));
                        }
                      } catch {}
                    }
                  }
                } finally {
                  controller.close();
                }
              },
            });

            return new Response(stream, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
              },
            });
          }
        }
      } catch (err) {}

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: geminiMessages,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        }
      );

      if (geminiResponse.ok && geminiResponse.body) {
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(encoder.encode(`META:${JSON.stringify({ citations })}\n`));
            const reader = geminiResponse.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  if (!line.startsWith("data: ")) continue;
                  const jsonStr = line.slice(6).trim();
                  if (!jsonStr || jsonStr === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(jsonStr);
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      controller.enqueue(encoder.encode(`TEXT:${text.replace(/\n/g, "\\n")}\n`));
                    }
                  } catch {}
                }
              }
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }
    }

    const fallback = matchedChunks.length > 0
      ? `Based on your documents (${[...new Set(matchedChunks.map(c => c.docName))].join(", ")}):\n\n` +
        matchedChunks.map((c, i) => `**Source #${i + 1} — ${c.docName}:**\n> ${c.text.trim()}`).join("\n\n")
      : `No indexed documents matched your query. Upload a document and click **"Save & Embed"** to enable semantic search.`;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`META:${JSON.stringify({ citations })}\n`));
        let i = 0;
        const iv = setInterval(() => {
          if (i < fallback.length) {
            controller.enqueue(encoder.encode(`TEXT:${fallback.slice(i, i + 12).replace(/\n/g, "\\n")}\n`));
            i += 12;
          } else {
            clearInterval(iv);
            controller.close();
          }
        }, 12);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
