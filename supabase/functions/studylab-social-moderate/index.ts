import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const BUCKET = "studylab-social";
const MODEL = "omni-moderation-latest";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

type ContentType = "post" | "comment";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
    return json({ error: "Moderation service is not configured" }, 503);
  }

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Authentication required" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);
    const userId = authData.user.id;

    const body = await req.json().catch(() => null);
    const contentType = body?.content_type as ContentType;
    const contentId = typeof body?.content_id === "string" ? body.content_id : "";
    if (!["post", "comment"].includes(contentType) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contentId)) {
      return json({ error: "Invalid moderation request" }, 400);
    }

    let text = "";
    let imageRows: { bucket_path: string; mime_type: string }[] = [];
    let table = contentType === "post" ? "studylab_social_posts" : "studylab_social_comments";

    if (contentType === "post") {
      const { data: post, error } = await admin.from(table)
        .select("id,author_id,body,status").eq("id", contentId).maybeSingle();
      if (error) throw error;
      if (!post || post.author_id !== userId) return json({ error: "Post not found" }, 404);
      if (post.status !== "pending") return json({ status: post.status, already_processed: true });
      text = post.body || "";

      const { data: images, error: imageError } = await admin.from("studylab_social_post_images")
        .select("bucket_path,mime_type").eq("post_id", contentId);
      if (imageError) throw imageError;
      imageRows = images || [];
    } else {
      const { data: comment, error } = await admin.from(table)
        .select("id,author_id,body,status").eq("id", contentId).maybeSingle();
      if (error) throw error;
      if (!comment || comment.author_id !== userId) return json({ error: "Comment not found" }, 404);
      if (comment.status !== "pending") return json({ status: comment.status, already_processed: true });
      text = comment.body || "";
    }

    const inputs: Record<string, unknown>[] = [];
    if (text.trim()) inputs.push({ type: "text", text });

    for (const image of imageRows) {
      const { data: file, error } = await admin.storage.from(BUCKET).download(image.bucket_path);
      if (error || !file) throw new Error("Could not retrieve an uploaded image for moderation");
      const base64 = await blobToBase64(file);
      inputs.push({
        type: "image_url",
        image_url: { url: `data:${image.mime_type};base64,${base64}` }
      });
    }

    if (!inputs.length) return json({ error: "No content to moderate" }, 400);

    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: MODEL, input: inputs })
    });
    if (!response.ok) {
      console.error("OpenAI moderation request failed:", response.status);
      return json({ error: "AI moderation is temporarily unavailable" }, 502);
    }

    const payload = await response.json();
    const result = payload?.results?.[0];
    if (!result || typeof result.flagged !== "boolean") {
      return json({ error: "AI moderation returned an invalid result" }, 502);
    }

    // Image posts always remain private until a human admin reviews them.
    // The moderation model is not a CSAM detector and cannot replace child-safety review.
    const imageReviewRequired = contentType === "post" && imageRows.length > 0;
    const autoApprove = !result.flagged && !imageReviewRequired;
    let finalStatus = "pending";

    if (autoApprove) {
      const { data: updated, error } = await admin.from(table)
        .update({ status: "approved" })
        .eq("id", contentId)
        .eq("author_id", userId)
        .eq("status", "pending")
        .select("id,status").maybeSingle();
      if (error) throw error;
      finalStatus = updated?.status || "pending";
    }

    return json({
      success: true,
      status: finalStatus,
      flagged: result.flagged,
      image_review_required: imageReviewRequired,
      review_required: finalStatus !== "approved",
      model: MODEL
    });
  } catch (error) {
    console.error("StudyLab Social AI moderation failed:", error);
    return json({ error: "AI moderation could not be completed" }, 500);
  }
});

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
