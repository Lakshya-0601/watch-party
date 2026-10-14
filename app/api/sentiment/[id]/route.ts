import { connection, type NextRequest } from "next/server";
import { TITLES } from "@/lib/data/titles";
import { reportFor, submitReview } from "@/lib/sentiment/pipeline";

const MAX_REVIEW_LENGTH = 500;

const findTitle = (id: string) => TITLES.find((t) => t.id === id);

/**
 * GET /api/sentiment/:id
 * Full sentiment report: index, trend, distribution, aspects, latest reviews.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sentiment/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const title = findTitle(id);
  if (!title) return Response.json({ error: "Unknown title" }, { status: 404 });
  return Response.json(reportFor(title));
}

/**
 * POST /api/sentiment/:id  { text: string }
 * Scores a raw review with the model, adds it to the corpus and returns the
 * scored review plus the refreshed report.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/sentiment/[id]">) {
  const { id } = await ctx.params;
  const title = findTitle(id);
  if (!title) return Response.json({ error: "Unknown title" }, { status: 404 });

  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return Response.json({ error: "Body must be JSON: { text: string }" }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Review text is required." }, { status: 400 });
  }
  if (text.length > MAX_REVIEW_LENGTH) {
    return Response.json({ error: `Keep reviews under ${MAX_REVIEW_LENGTH} characters.` }, { status: 400 });
  }

  const review = submitReview(title, text.trim());
  return Response.json({ review, report: reportFor(title) }, { status: 201 });
}
