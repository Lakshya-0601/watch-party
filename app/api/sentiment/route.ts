import { connection } from "next/server";
import { TITLES } from "@/lib/data/titles";
import { MODEL, summaryFor } from "@/lib/sentiment/pipeline";

/**
 * GET /api/sentiment
 * Audience Sentiment Index for every title (used by the dashboard cards).
 */
export async function GET() {
  await connection(); // live data: always run at request time
  const now = Date.now();
  const titles = Object.fromEntries(TITLES.map((t) => [t.id, summaryFor(t, now)]));
  return Response.json({ model: MODEL, updatedAt: now, titles });
}
