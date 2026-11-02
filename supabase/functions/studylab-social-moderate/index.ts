import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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
    return json({ error: "Publishing service is not configured" }, 503);
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

    const body = await req.json().catch(() => null);
    const contentType = body?.content_type as ContentType;
    const contentId = typeof body?.content_id === "string" ? body.content_id : "";
    if (!["post", "comment"].includes(contentType) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contentId)) {
      return json({ error: "Invalid publishing request" }, 400);
    }

    const table = contentType === "post" ? "studylab_social_posts" : "studylab_social_comments";
    const { data: item, error: itemError } = await admin.from(table)
      .select("id,author_id,status").eq("id", contentId).maybeSingle();
    if (itemError) throw itemError;
    if (!item || item.author_id !== authData.user.id) {
      return json({ error: "Content not found" }, 404);
    }

    // Posts remain private in the temporary upload state. Publish only after
    // all image files and metadata have been saved successfully.
    if (contentType === "post" && item.status === "uploading") {
      const { data: updated, error: updateError } = await admin.from(table)
        .update({ status: "approved" })
        .eq("id", contentId)
        .eq("author_id", authData.user.id)
        .eq("status", "uploading")
        .select("id,status").maybeSingle();
      if (updateError) throw updateError;
      return json({ success: true, status: updated?.status || "uploading" });
    }

    // Comments are published by their database trigger. This response also
    // keeps older cached clients compatible with the direct-publish workflow.
    return json({ success: true, status: item.status, already_published: true });
  } catch (error) {
    console.error("StudyLab Social publishing failed:", error);
    return json({ error: "Publishing could not be completed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
