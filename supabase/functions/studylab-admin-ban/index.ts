import { createClient } from "npm:@supabase/supabase-js@2.99.2";

/**
 * StudyLab moderation: server-authorized Auth ban / unban.
 * SUPABASE_SERVICE_ROLE_KEY is NEVER shipped to Netlify or the browser.
 */
const url = Deno.env.get("SUPABASE_URL") ?? "";
const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const allowed = new Set([
  "https://studylablk.netlify.app",
  "https://deploy-preview-102--studylablk.netlify.app",
]);
const json = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
      "Cache-Control": "no-store",
    },
  });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!allowed.has(origin)) {
    return new Response("Forbidden origin", { status: 403 });
  }
  if (req.method === "OPTIONS") return json({ ok: true }, 200, origin);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  const authHeader = req.headers.get("authorization") || "";
  const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];
  if (!token || !url || !adminKey || !publishableKey) {
    return json({ error: "Not authorized or moderation service unavailable" }, 401, origin);
  }
  try {
    const input = await req.json();
    const target = String(input?.user_id || "");
    const hours = Number(input?.hours);
    const reason = String(input?.reason || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(target) || ![0, 24, 168, 720, 876000].includes(hours) ||
        (hours !== 0 && (reason.length < 3 || reason.length > 500))) {
      return json({ error: "Invalid account, duration or moderation reason" }, 400, origin);
    }

    const member = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: identity, error: identityError } = await member.auth.getUser(token);
    if (identityError || !identity.user || identity.user.is_anonymous) {
      return json({ error: "Please sign in as an administrator" }, 401, origin);
    }
    const { data: isAdmin, error: accessError } =
      await member.rpc("studylab_social_is_admin");
    if (accessError || isAdmin !== true) {
      return json({ error: "Administrator access required" }, 403, origin);
    }
    const { error: preflightError } =
      await member.rpc("studylab_admin_ban_preflight", { p_user: target });
    if (preflightError) return json({ error: preflightError.message }, 403, origin);

    const service = createClient(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: before, error: beforeError } = await service.auth.admin.getUserById(target);
    if (beforeError || !before?.user) return json({ error: "Account not found" }, 404, origin);
    const originalUntil = before.user.banned_until ? Date.parse(before.user.banned_until) : 0;
    const banDuration = hours === 0 ? "none" : hours + "h";
    const { error: authError } =
      await service.auth.admin.updateUserById(target, { ban_duration: banDuration });
    if (authError) return json({ error: "Unable to change account sign-in status" }, 502, origin);

    const { data: committed, error: commitError } =
      await member.rpc("studylab_admin_ban_commit", {
        p_user: target, p_hours: hours, p_reason: reason,
      });
    if (commitError) {
      // Best-effort restore of the previous Auth state on a database failure.
      const remainingHours = originalUntil > Date.now()
        ? Math.max(1, Math.ceil((originalUntil - Date.now()) / 3600000)) + "h" : "none";
      await service.auth.admin.updateUserById(target, { ban_duration: remainingHours });
      return json({ error: "Moderation could not be saved; check account status" }, 409, origin);
    }
    return json({ ok: true, banned: Boolean(committed?.banned),
      expires_at: committed?.expires_at || null }, 200, origin);
  } catch (_) {
    return json({ error: "Moderation request could not be completed" }, 500, origin);
  }
});
