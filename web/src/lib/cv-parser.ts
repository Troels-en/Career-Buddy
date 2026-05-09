// Client-side CV text extraction from PDF and DOCX files.
// Uses pdfjs-dist for PDFs and mammoth for .docx.

export async function extractCvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdf(file);
  }
  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractDocx(file);
  }
  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return await file.text();
  }
  throw new Error("Unsupported file. Please upload .pdf, .docx, or .txt");
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url" as string);
  const workerUrl = (workerMod as { default: string }).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n\n";
  }
  return text.trim();
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser" as string)) as {
    extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value.trim();
}