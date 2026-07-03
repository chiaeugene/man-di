import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/tenant";
import { LlmNotConfiguredError } from "@/lib/ai/engine";

// Uniform error handling for route handlers.
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof LlmNotConfiguredError) {
      return NextResponse.json(
        {
          error:
            "No AI provider configured. Add ANTHROPIC_API_KEY (or OPENAI_API_KEY with LLM_PROVIDER=openai) to mandy/.env and restart.",
        },
        { status: 503 }
      );
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}
