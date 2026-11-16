/* Admin operations: only the authorized connected PR or live deployment can mutate Supabase. */
(function () {
  "use strict";
  const mode = window.StudyLabAdminConfig?.mode || "preview";
  const preview = mode === "preview";
  const connectedPreview = mode === "connected";
  const client = window.supabase?.createClient(
    "https://zpvatyxdbshjuqgtexzw.supabase.co",
    "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB",
  );
  const KEY = "studylab-admin-preview-v1";
  let state, user, seed, livePreviewStats = null, livePreviewError = null;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  async function rpc(name, args) {
    const r = await client.rpc(name, args);
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  function persist() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function audit(action, target) {
    state.activity.unshift({
      id: "preview-" + crypto.randomUUID(),
      action,
      target,
      actor: user.id,
      created_at: new Date().toISOString(),
    });
    state.activity = state.activity.slice(0, 200);
  }
  function requireAccess() {
    if (!user) throw Error("Admin access required.");
  }
  function safeURL(value, image = false) {
    value = String(value || "").trim();
    if (!value) return "";
    if (preview && state?.media?.some((x) => x.url === value)) return value;
    if (value.length > 2048) throw Error("Link is too long.");
    if (/[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith("//"))
      throw Error("Use an ordinary website link or a site-relative path.");
    // A bare domain must NOT be interpreted as a path on studylablk.netlify.app.
    // Keep single filenames such as maths.html and paths like ./lessons local.
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value) &&
        !/^(?:[./?#]|\w+\.html(?:[?#]|$))/i.test(value) &&
        /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::[0-9]{2,5})?(?:[/?#]|$)/i.test(value)) {
      value = "https://" + value;
    }
    const url = new URL(value, location.href);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
      throw Error("Only normal HTTP or HTTPS website links are supported.");
    if (image && url.origin !== location.origin && url.protocol !== "https:")
      throw Error("External image URLs must use HTTPS.");
    return value;
  }
  function validate(item) {
    if (!item.title?.trim() || item.title.length > 160)
      throw Error("Enter a title of 1–160 characters.");
    if ((item.description || "").length > 1500)
      throw Error("Description is too long.");
    if (!Number.isInteger(item.order) || item.order < 0 || item.order > 10000)
      throw Error("Order must be 0–10000.");
    if (item.kind === "card" && !item.url)
      throw Error("Add a destination link.");
    item.url = safeURL(item.url);
    item.image = safeURL(item.image, true);
    if (item.kind === "card") {
      item.button_label = String(item.button_label || "Open resource").trim();
      if (!item.button_label || item.button_label.length > 22 ||
          /[\u0000-\u001f<>]/.test(item.button_label))
        throw Error("Button label must be 1–22 plain-text characters.");
    }
    if (
      ![
        "index.html",
        "maths.html",
        "physics.html",
        "chemistry.html",
        "biology.html",
        "Telegram_Channels.html",
        "lesson-packs.html",
      ].includes(item.page)
    )
      throw Error("Choose a supported page.");
    return item;
  }
  async function init() {
    if (!client)
      throw Error("Could not load the account service. Reload to retry.");
    const result = await client.auth.getUser();
    if (result.error || !result.data?.user || result.data.user.is_anonymous)
      throw Error(
        "Sign in to your admin account from StudyLab, then open this page again.",
      );
    if ((await rpc("studylab_social_is_admin")) !== true)
      throw Error("This account does not have admin access.");
    user = result.data.user;
    const response = await fetch("assets/data/admin-content-seed.json");
    if (!response.ok) throw Error("Could not load existing content.");
    seed = await response.json();
    if (preview) {
      // An interrupted write or an older preview schema must not leave the
      // Overview empty. Preserve valid drafts and repair missing collections.
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(KEY));
      } catch (_) {
        // Invalid device data is repaired below. It is never trusted as access.
      }
      const sampleUsers = [
        {
          id: user.id,
          display_name: "Your admin account",
          username: "you",
          admin: true,
          verified: true,
          created_at: user.created_at,
        },
        ...[
          "Amani Perera",
          "Kavindu Silva",
          "Nethmi Jayasinghe",
          "Sahan Bandara",
        ].map((n, i) => ({
          id: "sample-user-" + i,
          display_name: n,
          username: n.split(" ")[0].toLowerCase(),
          admin: i === 0,
          verified: i === 1,
          created_at: "2026-11-01T00:00:00Z",
        })),
      ];
      const sameOwner = stored && typeof stored === "object" &&
        !Array.isArray(stored) && stored.owner === user.id;
      const cleanArray = (key, valid) => sameOwner && Array.isArray(stored[key])
        ? stored[key].filter(valid) : [];
      state = {
        owner: user.id,
        content: cleanArray("content", (x) => x && typeof x.id === "string" && x.draft && typeof x.draft === "object"),
        published: cleanArray("published", (x) => x && typeof x.id === "string"),
        activity: cleanArray("activity", (x) => x && typeof x.action === "string"),
        media: cleanArray("media", (x) => x && typeof x.path === "string"),
        deleted: cleanArray("deleted", (x) => typeof x === "string"),
        popups: cleanArray("popups", (x) => x && typeof x.id === "string"),
        users: cleanArray("users", (x) => x && typeof x.id === "string" &&
          typeof x.display_name === "string" && typeof x.username === "string"),
      };
      if (!state.users.some((x) => x.id === user.id)) {
        state.users.unshift(sampleUsers[0]);
      }
      if (!sameOwner || state.users.length === 1) {
        for (const u of sampleUsers.slice(1)) {
          if (!state.users.some((x) => x.id === u.id)) state.users.push(u);
        }
      }
      try {
        persist();
      } catch (_) {
        // Browsers that deny storage can still use the in-memory preview.
      }
    }
    // Read-only server-side snapshot: the existing three-admin RPC gate is
    // checked before this call. This never changes production user records.
    {
      try {
        const latest = await rpc("studylab_admin_readonly_stats_v1");
        if (latest && typeof latest === "object" &&
            Number.isFinite(Number(latest.profiles)) &&
            Number.isFinite(Number(latest.admins)) &&
            Number.isFinite(Number(latest.registered)) &&
            Number.isFinite(Number(latest.social_posts))) {
          livePreviewStats = latest;
        } else {
          livePreviewError = "The live preview data service is not available.";
        }
      } catch (error) {
        livePreviewError = error.message || "Could not load live statistics.";
      }
    }
    return { user, preview, liveData: Boolean(livePreviewStats) };
  }
  async function content() {
    requireAccess();
    const rows = preview
      ? state.content
      : await rpc("studylab_admin_content_list");
    const map = new Map(
      seed.map((x) => [
        x.id,
        { id: x.id, draft: x, revision: 0, published: true, builtin: true },
      ]),
    );
    for (const id of preview ? (state.deleted || []) : []) map.delete(id);
    for (const r of rows || []) {
      if (r.deleted) {
        map.delete(r.id);
        continue;
      }
      map.set(r.id, { ...r, builtin: map.has(r.id) });
    }
    return [...map.values()];
  }
  async function save(item, revision, action) {
    requireAccess();
    validate(item);
    if (!["draft", "publish", "hide", "restore"].includes(action))
      throw Error("Invalid action.");
    if (!preview)
      return rpc("studylab_admin_action_v2", {
        p_kind: "content", p_action: action,
        p_data: { item, revision },
      });
    const old = state.content.find((x) => x.id === item.id);
    if ((old?.revision || 0) !== revision)
      throw Error("This item changed. Reload before saving.");
    const row = {
      id: item.id,
      draft: clone(item),
      revision: revision + 1,
      has_draft: action === "draft",
      published: old?.published ?? seed.some((x) => x.id === item.id),
    };
    if (action !== "draft") {
      row.published = true;
      const published = {
        ...clone(item),
        hidden:
          action === "hide" ? true : action === "restore" ? false : item.hidden,
      };
      state.published = state.published.filter((x) => x.id !== item.id);
      state.published.push(published);
      row.draft = published;
    }
    state.content = state.content.filter((x) => x.id !== item.id);
    state.content.push(row);
    audit(action, item.title);
    persist();
    return row;
  }
  async function deleteContent(record) {
    requireAccess();
    const { id, kind, page, title } = record.draft;
    if (kind === "section" && record.builtin)
      throw Error("Built-in sections cannot be deleted. Use Hide instead.");
    if (!preview) return rpc("studylab_admin_action_v2", {
      p_kind: "content", p_action: "delete",
      p_data: { id, page, kind, revision: record.revision,
        builtin: Boolean(record.builtin) },
    });
    const current = state.content.find((x) => x.id === id);
    if ((current?.revision || 0) !== record.revision)
      throw Error("This item changed. Reload before deleting.");
    const ids = new Set([id]);
    if (kind === "section") {
      for (const x of state.content) {
        if (x.draft?.section === id) ids.add(x.id);
      }
      for (const x of state.published) {
        if (x.section === id) ids.add(x.id);
      }
    }
    state.content = state.content.filter((x) => !ids.has(x.id));
    state.published = state.published.filter((x) => !ids.has(x.id));
    state.deleted = (state.deleted || []).filter((x) => !ids.has(x));
    if (record.builtin) state.deleted.push(id);
    audit("Delete " + kind, title);
    persist();
    return { deleted: true, deleted_children: ids.size - 1 };
  }
  async function popups() {
    requireAccess();
    return preview ? clone(state.popups || []) : rpc("studylab_admin_popup_list");
  }
  async function popupSet(action, data = {}) {
    requireAccess();
    if (!["create","update","delete"].includes(action))
      throw Error("Invalid popup action");
    if (preview) {
      const current = state.popups || [];
      if (action === "delete") {
        state.popups = current.filter(x => x.id !== data.id);
      } else {
        const starts = action === "create"
          ? (data.starts_at || new Date().toISOString())
          : current.find(x => x.id === data.id)?.starts_at;
        if (!starts) throw Error("Pop-up not found");
        const item = { ...data,
          link_label: String(data.link_label || "View").trim(),
          id: action === "create" ? crypto.randomUUID() : data.id,
          starts_at: starts,
          expires_at: new Date(new Date(starts).getTime()+86400000).toISOString(),
          delivered: 0,
        };
        state.popups = action === "create"
          ? [item,...current]
          : current.map(x => x.id === item.id ? item : x);
      }
      audit("Pop-up " + action, data.title || data.id);
      persist();
      return;
    }
    return rpc("studylab_admin_action_v2", {
      p_kind: "popup", p_action: action,
      p_data: { ...data, link: safeURL(data.link || ""),
        link_label: String(data.link_label || "View").trim() },
    });
  }
  async function banUser(id, hours, reason = "") {
    requireAccess();
    if (preview) {
      if (livePreviewStats) throw Error("Read-only preview does not allow moderation.");
      const found = state.users.find(x => x.id === id);
      if (!found || found.admin || found.guest || id === user.id)
        throw Error("This account cannot be banned.");
      found.banned = hours !== 0;
      audit(hours ? "Ban account" : "Unban account", found.display_name);
      persist();
      return;
    }
    if (!client.functions?.invoke)
      throw Error("The account moderation service is not loaded.");
    const r = await client.functions.invoke("studylab-admin-ban", {
      body: { user_id: id, hours, reason },
    });
    if (r.error) {
      const details = await r.error.context?.json?.().catch(() => null);
      throw Error(details?.error || r.error.message || "Could not moderate account.");
    }
    if (!r.data?.ok) throw Error(r.data?.error || "Account moderation failed");
    return r.data;
  }
  async function users(query = "", page = 0, admins = false) {
    requireAccess();
    if (!preview)
      return rpc("studylab_admin_users", {
        p_query: query,
        p_page: page,
        p_admins: admins,
      });
    if (livePreviewStats) {
      const result = await rpc("studylab_admin_readonly_users_v1", {
        p_query: query,
        p_page: page,
        p_admins: admins,
      });
      if (!result || !Array.isArray(result.rows) ||
          !Number.isFinite(Number(result.total))) {
        throw Error("The real account list returned an unexpected response.");
      }
      return result;
    }
    const a = state.users.filter(
      (x) =>
        (!admins || x.admin) &&
        (x.display_name + " " + x.username)
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    return { rows: a.slice(page * 20, page * 20 + 20), total: a.length };
  }
  async function setUser(id, field, value) {
    requireAccess();
    if (!["admin", "verified"].includes(field))
      throw Error("Invalid user action.");
    if (!preview)
      return rpc("studylab_admin_action_v2", {
        p_kind: "user", p_action: "set",
        p_data: { id, field, value },
      });
    if (livePreviewStats) {
      throw Error("Preview is read-only. No live account or badge changes are permitted.");
    }
    const u = state.users.find((x) => x.id === id);
    if (!u) throw Error("User not found.");
    if (field === "admin" && !value) {
      if (id === user.id)
        throw Error("Ask another admin to remove your access.");
      if (state.users.filter((x) => x.admin).length <= 1)
        throw Error("Keep at least one admin.");
    }
    u[field] = value;
    audit((value ? "Grant " : "Remove ") + field, u.display_name);
    persist();
  }
  async function activity() {
    requireAccess();
    return preview ? clone(state.activity) : await rpc("studylab_admin_activity");
  }
  async function history(action, id = null) {
    requireAccess();
    if (!["clear","clear_all","undo"].includes(action))
      throw Error("Invalid history action.");
    if (preview) {
      if (action === "undo")
        throw Error("Undo is only available for server-verified changes.");
      const before = state.activity.length;
      state.activity = action === "clear_all" ? [] :
        state.activity.filter((item) => item.id !== id);
      if (action === "clear" && before === state.activity.length)
        throw Error("History entry no longer exists.");
      persist();
      return { cleared: before - state.activity.length };
    }
    return rpc("studylab_admin_history_set", {
      p_action: action, p_id: id,
    });
  }
  async function media() {
    requireAccess();
    if (preview) return state.media;
    const r = await client.storage
      .from("studylab-admin-media")
      .list("uploads", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
    if (r.error) throw r.error;
    return r.data
      .filter((x) => x.id)
      .map((x) => ({
        name: x.name,
        path: "uploads/" + x.name,
        url: client.storage
          .from("studylab-admin-media")
          .getPublicUrl("uploads/" + x.name).data.publicUrl,
      }));
  }
  async function upload(file) {
    requireAccess();
    const types = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    };
    if (!types[file.type]) throw Error("Upload a JPG, PNG, WebP or PDF file.");
    if (file.size > 5 * 1024 * 1024)
      throw Error("Files must be 5 MB or smaller.");
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const valid =
      file.type === "application/pdf"
        ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
        : file.type === "image/png"
          ? bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          : file.type === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid) throw Error("The file contents do not match its type.");
    if (preview) {
      if (file.size > 1024 * 1024)
        throw Error(
          "Preview stores files on this device. Use a file under 1 MB for this preview.",
        );
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const item = { name: file.name, path: crypto.randomUUID(), url };
      state.media.unshift(item);
      audit("Upload preview file", file.name);
      try {
        persist();
      } catch (e) {
        state.media.shift();
        throw Error("Device storage is full. Remove a preview file and retry.");
      }
      return item;
    }
    const path = "uploads/" + crypto.randomUUID() + "." + types[file.type];
    const r = await client.storage
      .from("studylab-admin-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (r.error) throw r.error;
    return {
      name: file.name,
      path,
      url: client.storage.from("studylab-admin-media").getPublicUrl(path).data
        .publicUrl,
    };
  }
  async function removeMedia(path) {
    requireAccess();
    if (preview) {
      state.media = state.media.filter((x) => x.path !== path);
      audit("Remove preview file", path);
      persist();
      return;
    }
    const r = await client.storage.from("studylab-admin-media").remove([path]);
    if (r.error) throw r.error;
  }
  function reset() {
    requireAccess();
    if (!preview) throw Error("Only available in preview.");
    localStorage.removeItem(KEY);
    location.reload();
  }
  window.StudyLabAdminAPI = Object.freeze({
    init,
    content,
    save,
    deleteContent,
    popups,
    popupSet,
    banUser,
    users,
    setUser,
    activity,
    history,
    media,
    upload,
    removeMedia,
    reset,
    validate,
    safeURL,
    preview,
    connectedPreview,
    get readonlyLive() { return preview && Boolean(livePreviewStats); },
    get liveStats() { return livePreviewStats ? clone(livePreviewStats) : null; },
    get liveStatsError() { return livePreviewError; },
    previewKey: KEY,
  });
})();
