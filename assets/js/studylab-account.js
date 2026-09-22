/* =========================================================
   STUDY LAB — SUPABASE STUDENT ACCOUNT
   Anonymous Supabase identity + cloud profile.
   The browser stores only the Supabase auth session so the
   same student can be recognised on later visits to this browser.
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    url: "https://zpvatyxdbshjuqgtexzw.supabase.co",
    publishableKey: "sb_publishable_zd8S3PcyicJX6Cgyh0ez8A_sUSTCuiB"
  };

  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    window.StudyLabAccount = {
      ready: Promise.reject(new Error("Supabase client unavailable")),
      client: null,
      user: null,
      profile: null
    };
    return;
  }

  const client = window.supabase.createClient(
    CONFIG.url,
    CONFIG.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );

  let user = null;
  let profile = null;

  async function ensureSignedIn() {
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) throw sessionError;

    let session = sessionData?.session || null;

    if (!session) {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      session = data?.session || null;
    }

    if (!session?.user) {
      throw new Error("StudyLab could not create a student account.");
    }

    user = session.user;
    return user;
  }

  async function loadProfile() {
    if (!user) return null;

    const { data, error } = await client
      .from("studylab_profiles")
      .select("id,display_name,created_at,updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    profile = data || null;
    return profile;
  }

  async function saveProfile(name) {
    const cleanName = String(name || "")
      .trim()
      .replace(/\s+/g, " ");

    if (cleanName.length < 2) {
      throw new Error("Please enter your name.");
    }

    if (cleanName.length > 60) {
      throw new Error("Please keep your name under 60 characters.");
    }

    if (!user) {
      await ready;
    }

    const { data, error } = await client
      .from("studylab_profiles")
      .upsert(
        {
          id: user.id,
          display_name: cleanName,
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      )
      .select("id,display_name,created_at,updated_at")
      .single();

    if (error) throw error;

    profile = data;
    return profile;
  }

  async function getProfile(force = false) {
    if (!user) await ready;
    if (!force && profile) return profile;
    return loadProfile();
  }

  async function updateProfileFromAuth() {
    const result = await loadProfile().catch(() => null);
    profile = result || profile;
    return profile;
  }

  const ready = (async function () {
    const currentUser = await ensureSignedIn();
    await loadProfile();

    /*
     * One-time migration of the old local profile.
     * Once the cloud profile is confirmed, the old profile is removed.
     */
    if (!profile) {
      try {
        const raw = localStorage.getItem("studyLabProfile");
        const local = raw ? JSON.parse(raw) : null;

        if (local?.name) {
          await saveProfile(local.name);
          localStorage.removeItem("studyLabProfile");
        }
      } catch (migrationError) {
        console.warn("StudyLab profile migration:", migrationError);
      }
    }

    return currentUser;
  })();

  client.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      user = session.user;
      if (event === "USER_UPDATED") {
        updateProfileFromAuth();
      }
    }
  });

  window.StudyLabAccount = {
    client,
    ready,
    getUser: () => user,
    getProfile,
    saveProfile
  };
})();
