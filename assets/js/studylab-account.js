/* =========================================================
   STUDY LAB — SUPABASE STUDENT ACCOUNT
   Google and guest Supabase identity + cloud profile.
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
        detectSessionInUrl: true
      }
    }
  );

  let user = null;
  let profile = null;

  // Restore existing sessions only. New visitors choose Google or Guest.
  async function restoreSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data?.session || null;
    if (session?.user) user = session.user;
    return session;
  }

  async function loadProfile() {
    if (!user) return null;

    const { data, error } = await client
      .from("studylab_profiles")
      .select("id,display_name,username,school,phone,exam_year,study_stream,gender,profile_completed_at,created_at,updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    profile = data || null;
    return profile;
  }

  function isProfileComplete(p) {
    return Boolean(p?.profile_completed_at && p?.display_name &&
      !/^Student\d{4}$/.test(String(p.display_name)) &&
      String(p.school || "").trim() && String(p.phone || "").trim() &&
      p?.exam_year && p?.study_stream && ["male", "female"].includes(p?.gender));
  }

  function makeDefaultStudentName() {
    if (!user?.id) return "Student0000";

    const compactId = user.id.replace(/-/g, "").slice(0, 8);
    const numericPart = parseInt(compactId, 16);

    if (!Number.isFinite(numericPart)) {
      return "Student0000";
    }

    return "Student" +
      String(numericPart % 10000).padStart(4, "0");
  }

  async function ensureProfileRow() {
    if (!user) return null;
    if (profile) return profile;

    const { data, error } = await client
      .from("studylab_profiles")
      .upsert(
        {
          id: user.id,
          display_name: makeDefaultStudentName(),
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      )
      .select("id,display_name,username,school,phone,exam_year,study_stream,gender,profile_completed_at,created_at,updated_at")
      .single();

    if (error) throw error;

    profile = data;
    return profile;
  }

  async function saveProfile(name, details = {}) {
    const cleanName = String(name || "")
      .trim()
      .replace(/\s+/g, " ");

    if (cleanName.length < 2) throw new Error("Please enter your name.");
    if (cleanName.length > 60) throw new Error("Please keep your name under 60 characters.");
    if (!user) await ready;

    const cleanUsername = String(details.username || "").trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      throw new Error("Username must be 3–24 characters using lowercase letters, numbers, or underscores.");
    }

    const requireFullProfile = details.require_full_profile === true;
    const cleanOptional = value => {
      const result = String(value || "").trim().replace(/\s+/g, " ");
      return result || null;
    };
    const school = cleanOptional(details.school);
    const phone = cleanOptional(details.phone);
    const examYear = String(details.exam_year || "").trim();
    const studyStream = String(details.study_stream || "").trim();
    const gender = String(details.gender || "").trim();

    if (school && school.length < 2) throw new Error("Please enter a valid school name.");
    if (requireFullProfile && !school) throw new Error("Please enter your school name.");

    const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
    if (phone && (phoneDigits.length < 9 || phoneDigits.length > 12)) {
      throw new Error("Please enter a valid mobile number (9–12 digits, including country code if used).");
    }
    if (requireFullProfile && !phone) {
      throw new Error("Please enter your mobile number.");
    }

    if (!["2026", "2027", "2028", "2029", "Other"].includes(examYear)) {
      throw new Error("Please choose your A/L examination year.");
    }
    if (!["Physical Science", "Biological Science", "Commerce", "Arts", "Engineering Technology", "Bio Systems Technology", "Other"].includes(studyStream)) {
      throw new Error("Please choose your study stream.");
    }
    if (gender && !["male", "female"].includes(gender)) {
      throw new Error("Please choose a valid profile icon.");
    }
    if (requireFullProfile && !["male", "female"].includes(gender)) {
      throw new Error("Please choose a profile icon.");
    }

    const fullDetailsComplete = Boolean(
      school && school.length >= 2 &&
      phone && phoneDigits.length >= 9 && phoneDigits.length <= 12 &&
      ["male", "female"].includes(gender)
    );
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("studylab_profiles")
      .upsert({
        id: user.id,
        display_name: cleanName,
        username: cleanUsername,
        school,
        phone,
        exam_year: examYear,
        study_stream: studyStream,
        gender: gender || null,
        profile_completed_at: fullDetailsComplete ? (profile?.profile_completed_at || now) : null,
        updated_at: now
      }, { onConflict: "id" })
      .select("id,display_name,username,school,phone,exam_year,study_stream,gender,profile_completed_at,created_at,updated_at")
      .single();

    if (error) {
      if (error.code === "23505" && String(error.message || "").includes("studylab_profiles_username_unique")) {
        throw new Error("That username is already taken. Please choose another.");
      }
      throw error;
    }
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

  let resolveReady;
  let readyResolved = false;
  let initializedUserId = "";
  let activationPromise = null;
  let startupError = null;
  let authIntent = "";
  try {
    const stored = sessionStorage.getItem("studylab-auth-intent");
    if (stored === "signup" || stored === "login") authIntent = stored;
  } catch (_) {}

  const ready = new Promise(resolve => { resolveReady = resolve; });

  function setAuthIntent(value) {
    authIntent = value === "signup" || value === "login" ? value : "";
    try {
      if (authIntent) sessionStorage.setItem("studylab-auth-intent", authIntent);
      else sessionStorage.removeItem("studylab-auth-intent");
    } catch (_) {}
  }

  async function activateSession(session, options = {}) {
    if (!session?.user) throw new Error("StudyLab could not start your account session.");
    if (initializedUserId === session.user.id) return user;
    if (activationPromise) return activationPromise;
    activationPromise = (async function () {
      user = session.user;
      await loadProfile();
      // Only anonymous Guest sessions may absorb the old local-only profile.
      if (!profile && options.migrateLegacy && user.is_anonymous) {
        try {
          const raw = localStorage.getItem("studyLabProfile");
          const local = raw ? JSON.parse(raw) : null;
          if (local?.name) {
            const legacyName = String(local.name).trim().replace(/\s+/g, " ");
            if (legacyName.length >= 2 && legacyName.length <= 60) {
              const { data: migrated, error: saveError } = await client.from("studylab_profiles")
                .upsert({ id: user.id, display_name: legacyName, updated_at: new Date().toISOString() }, { onConflict: "id" })
                .select("id,display_name,username,school,phone,exam_year,study_stream,gender,profile_completed_at,created_at,updated_at").single();
              if (saveError) throw saveError;
              profile = migrated;
              localStorage.removeItem("studyLabProfile");
            }
          }
        } catch (error) { console.warn("StudyLab legacy profile migration:", error); }
      }
      if (!profile) await ensureProfileRow();
      initializedUserId = user.id;
      if (!readyResolved) { readyResolved = true; resolveReady(user); }
      return user;
    })();
    try { return await activationPromise; }
    finally { activationPromise = null; }
  }

  async function continueAsGuest() {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    setAuthIntent("");
    return activateSession(data?.session, { migrateLegacy: true });
  }

  async function signInWithGoogle(intent) {
    if (intent !== "signup" && intent !== "login") throw new Error("Choose New User or Existing User.");
    setAuthIntent(intent);
    const options = {
      redirectTo: window.location.origin + "/",
      queryParams: { prompt: "select_account" }
    };
    // Link Google to the current anonymous identity for Guest account creation.
    // This preserves the same user ID and the Guest's cloud profile/activity.
    if (intent === "signup" && user?.is_anonymous) {
      const { error } = await client.auth.linkIdentity({ provider: "google", options });
      if (error) {
        setAuthIntent("");
        if (/identity.*already|already.*linked/i.test(String(error.message || ""))) {
          throw new Error("That Google account is already connected to a StudyLab account. Choose Sign In instead.");
        }
        throw error;
      }
      return;
    }
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options });
    if (error) { setAuthIntent(""); throw error; }
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    user = null;
    profile = null;
    initializedUserId = "";
    setAuthIntent("");
  }

  async function retryStartup() {
    startupError = null;
    const session = await restoreSession();
    if (!session) return false;
    await activateSession(session, { migrateLegacy: true });
    return true;
  }

  const startup = (async function () {
    const session = await restoreSession();
    if (!session) return false;
    // OAuth login is sign-in only at the StudyLab UI level. If Supabase created
    // a new identity for an unknown Google account, don't create its profile.
    if (authIntent === "login" && !session.user.is_anonymous) {
      await loadProfile();
      if (!profile) {
        await client.auth.signOut();
        user = null; profile = null;
        startupError = "no-profile";
        return false;
      }
    }
    await activateSession(session, { migrateLegacy: true });
    return true;
  })().catch(error => {
    startupError = error;
    console.warn("StudyLab session restore:", error);
    return false;
  });

  client.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      user = session.user;
      if (event === "USER_UPDATED" && initializedUserId) Promise.resolve().then(updateProfileFromAuth);
    } else if (event === "SIGNED_OUT") {
      user = null; profile = null; initializedUserId = "";
    }
  });

  window.StudyLabAccount = {
    client, ready, startup, continueAsGuest, signInWithGoogle, signOut, retryStartup,
    getStartupError: () => startupError,
    getAuthIntent: () => authIntent,
    clearAuthIntent: () => setAuthIntent(""),
    getSuggestedDisplayName: () => {
      const metadata = user?.user_metadata || {};
      return String(metadata.full_name || metadata.name || metadata.given_name || "").trim();
    },
    getUser: () => user, getProfile, saveProfile
  };

  // The Study Room page now owns its profile gate and displays the existing
  // profile modal over the room itself. Do not redirect away from the room.

})();
