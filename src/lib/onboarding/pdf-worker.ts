// Runs as a short-lived, isolated child process (spawned by pdf-isolated.ts)
// so a memory-heavy or malformed PDF can only crash THIS throwaway worker —
// never the main web server handling everyone else's requests.
import { readFile } from "node:fs/promises";
import { extractTextFromPdf } from "./documents";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log(JSON.stringify({ ok: false, error: "No file path provided." }));
    return;
  }
  try {
    const buffer = await readFile(filePath);
    const text = await extractTextFromPdf(buffer);
    console.log(JSON.stringify({ ok: true, text }));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Could not read that PDF." }));
  }
}

main();
