import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "studylab-social";
const OLD_CONTENT_DAYS = 30;

type PostRow = { id: string; status: string; created_at: string };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Server configuration missing" }, 500);

  // Supabase's gateway verifies the JWT signature before this function runs
  // (verify_jwt is enabled). Check its verified role instead of comparing the
  // raw token to an environment secret, which can drift after key rotation.
  const claims = readJwtClaims(req);
  if (claims?.role !== "service_role") {
    return json({ error: "Forbidden" }, 403);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const cutoff = new Date(Date.now() - OLD_CONTENT_DAYS * 86400000).toISOString();
    const { data: stale, error: staleError } = await supabase
      .from("studylab_social_posts")
      .select("id,status,created_at")
      .in("status", ["rejected", "removed", "pending"])
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(500);
    if (staleError) throw staleError;

    let deletedPosts = 0;
    let deletedObjects = 0;
    for (const post of (stale || []) as PostRow[]) {
      const result = await deletePost(supabase, post.id);
      if (result.ok) {
        deletedPosts++;
        deletedObjects += result.objects;
      }
    }

    // Measure usage for monitoring, but never auto-delete published student posts.
    const usedBytes = await getStorageUsage(supabase);

    return json({
      success: true,
      deletedOldPosts: deletedPosts,
      storageTrimmedPosts: 0,
      deletedStorageObjects: deletedObjects,
      trackedImageBytesAfterCleanup: usedBytes,
      approvedPostsPreserved: true
    });
  } catch (error) {
    console.error("StudyLab Social maintenance failed:", error);
    return json({ error: "Maintenance failed" }, 500);
  }
});

async function getStorageUsage(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { data, error } = await supabase.rpc("studylab_social_storage_usage_bytes");
  if (error) throw error;
  return Number(data || 0);
}

async function deletePost(supabase: ReturnType<typeof createClient>, postId: string) {
  const { data: rows, error: readError } = await supabase
    .from("studylab_social_post_images")
    .select("bucket_path")
    .eq("post_id", postId);
  if (readError) throw readError;

  const paths = (rows || []).map((row: { bucket_path: string }) => row.bucket_path);
  let removed = 0;
  for (const batch of chunks(paths, 100)) {
    if (!batch.length) continue;
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) return { ok: false, objects: removed };
    removed += batch.length;
  }

  const { error: deleteError } = await supabase
    .from("studylab_social_posts")
    .delete()
    .eq("id", postId);
  if (deleteError) return { ok: false, objects: removed };
  return { ok: true, objects: removed };
}

function readJwtClaims(req: Request): Record<string, unknown> | null {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
