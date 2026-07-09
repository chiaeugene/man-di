import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { PdfTooComplexError } from "./documents";

const WORKER_TIMEOUT_MS = 25_000;

export class PdfWorkerError extends Error {}

// Extracts PDF text in a separate OS process with its own memory space and a
// hard timeout. If the PDF is too large/complex and the OS kills the worker
// for memory, only that short-lived worker dies — the main server (and every
// other tenant's live WhatsApp conversation) is completely unaffected. This
// is what lets uploads be sized generously instead of guessing a "safe" cap.
export async function extractTextFromPdfIsolated(buffer: Buffer): Promise<string> {
  const tmpFile = path.join(tmpdir(), `mandy-pdf-${randomUUID()}.pdf`);
  await writeFile(tmpFile, buffer);

  try {
    // process.cwd() is the project root under `next start` (Render runs the
    // full repo checkout, not a serverless bundle), so the worker's actual
    // source file is reliably at this path — unlike relying on Next's
    // internal build output, which may not preserve a 1:1 file layout.
    const workerPath = path.join(process.cwd(), "src", "lib", "onboarding", "pdf-worker.ts");
    const tsxCli = path.join(path.dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");

    const result = await new Promise<{ ok: boolean; text?: string; error?: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [tsxCli, workerPath, tmpFile], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timeout = setTimeout(() => {
        settled = true;
        child.kill("SIGKILL");
        reject(new PdfWorkerError("That PDF took too long to process. Please try a smaller or simpler file."));
      }, WORKER_TIMEOUT_MS);

      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(err);
      });

      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        const lastLine = stdout.trim().split("\n").filter(Boolean).pop();
        if (lastLine) {
          try {
            resolve(JSON.parse(lastLine));
            return;
          } catch {
            // fall through — worker printed something that wasn't valid JSON
          }
        }
        console.error("[pdf-isolated] worker exited without valid output", {
          code,
          signal,
          stderr: stderr.slice(0, 2000),
        });
        reject(
          new PdfWorkerError("Could not process that PDF — it may be too large or complex. Please try a smaller file.")
        );
      });
    });

    if (!result.ok) throw new PdfTooComplexError(result.error || "Could not process that PDF.");
    return result.text ?? "";
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}
