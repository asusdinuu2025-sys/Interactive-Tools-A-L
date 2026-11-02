import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
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
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
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
    let imageCount = 0;
    let table = contentType === "post" ? "studylab_social_posts" : "studylab_social_comments";

    if (contentType === "post") {
      const { data: post, error } = await admin.from(table)
        .select("id,author_id,body,status").eq("id", contentId).maybeSingle();
      if (error) throw error;
      if (!post || post.author_id !== userId) return json({ error: "Post not found" }, 404);
      if (post.status !== "pending") return json({ status: post.status, already_processed: true });
      text = post.body || "";

      const { count, error: imageError } = await admin.from("studylab_social_post_images")
        .select("id", { count: "exact", head: true }).eq("post_id", contentId);
      if (imageError) throw imageError;
      imageCount = count || 0;
    } else {
      const { data: comment, error } = await admin.from(table)
        .select("id,author_id,body,status").eq("id", contentId).maybeSingle();
      if (error) throw error;
      if (!comment || comment.author_id !== userId) return json({ error: "Comment not found" }, 404);
      if (comment.status !== "pending") return json({ status: comment.status, already_processed: true });
      text = comment.body || "";
    }

    // Uploaded images are never sent to the external text moderation API.
    // Image-only posts publish immediately; captions still pass through text moderation.
    const imageReviewRequired = false;
    let flagged: boolean | null = null;
    let aiChecked = false;

    if (text.trim()) {
      if (!OPENAI_API_KEY) return json({ error: "Text moderation is not configured" }, 503);
      const response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: MODEL, input: text })
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
      flagged = result.flagged;
      aiChecked = true;
    }

    const imageOnlyPost = contentType === "post" && imageCount > 0 && !text.trim();
    const autoApprove = imageOnlyPost || (aiChecked && flagged === false);
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
      flagged,
      ai_checked: aiChecked,
      image_review_required: imageReviewRequired,
      review_required: finalStatus !== "approved",
      model: aiChecked ? MODEL : null
    });
  } catch (error) {
    console.error("StudyLab Social AI moderation failed:", error);
    return json({ error: "AI moderation could not be completed" }, 500);
  }
});


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
