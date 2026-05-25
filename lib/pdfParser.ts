import { PDFParse } from "pdf-parse";

/**
 * Resilient Server-Side PDF Text Extractor (pdf-parse v2 API)
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  let parser: InstanceType<typeof PDFParse> | null = null;
  try {
    // pdf-parse v2 uses a class-based API: new PDFParse({ data: buffer }).getText()
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || "";
  } catch (err: any) {

    // Fallback: extract readable plain-text segments from raw PDF byte streams
    const rawStr = buffer.toString("binary");
    const matches = rawStr.match(/[\x20-\x7E\s]{5,}/g) || [];
    const textSegments = matches.filter((s) => {
      const clean = s.trim();
      return (
        clean.length > 5 &&
        !clean.includes("obj") &&
        !clean.includes("endobj") &&
        !clean.includes("stream") &&
        !clean.includes("endstream") &&
        !clean.includes("xref") &&
        !clean.includes("trailer")
      );
    });

    const parsedText = textSegments.join("\n").replace(/\s+/g, " ");

    if (parsedText.length < 50) {
      return `⚠️ [PDF Parsing Warning]\nThis PDF appears to be compressed or encrypted and could not be fully extracted.`;
    }

    return parsedText;
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}
