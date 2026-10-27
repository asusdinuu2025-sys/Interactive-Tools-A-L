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
      .select("id,display_name,school,phone,exam_year,study_stream,gender,profile_completed_at,created_at,updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    profile = data || null;
    return profile;
  }

  function isProfileComplete(p) {
    return Boolean(p?.profile_completed_at && p?.display_name &&
      !/^Student\\d{4}$/.test(String(p.display_name)) &&
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
      .select("id,display_name,school,phone,exam_year,study_stream,gender,profile_completed_at,created_at,updated_at")
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

    const cleanOptional = value => {
      const result = String(value || "").trim().replace(/\s+/g, " ");
      return result || null;
    };
    const school = cleanOptional(details.school);
    const phone = cleanOptional(details.phone);
    const examYear = String(details.exam_year || "").trim();
    const studyStream = String(details.study_stream || "").trim();
    const gender = String(details.gender || "").trim();
    if (!school || school.length < 2) throw new Error("Please enter your school name.");
    const phoneDigits = phone ? phone.replace(/\\D/g, "") : "";
    if (phoneDigits.length < 9 || phoneDigits.length > 12) throw new Error("Please enter a valid mobile number (9–12 digits, including country code if used).");

    if (!["2026", "2027", "2028", "2029", "Other"].includes(examYear)) {
      throw new Error("Please choose your A/L examination year.");
    }
    if (!["Physical Science", "Biological Science", "Commerce", "Arts", "Engineering Technology", "Bio Systems Technology", "Other"].includes(studyStream)) {
      throw new Error("Please choose your study stream.");
    }
    if (!["male", "female"].includes(gender)) {
      throw new Error("Please choose a profile icon.");
    }

    const now = new Date().toISOString();
    const { data, error } = await client
      .from("studylab_profiles")
      .upsert({
        id: user.id,
        display_name: cleanName,
        school,
        phone,
        exam_year: examYear,
        study_stream: studyStream,
        gender,
        profile_completed_at: now,
        updated_at: now
      }, { onConflict: "id" })
      .select("id,display_name,school,phone,exam_year,study_stream,gender,profile_completed_at,created_at,updated_at")
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
          // Preserve legacy names without falsely marking the full profile complete.
          const legacyName = String(local.name).trim().replace(/\s+/g, " ");
          if (legacyName.length >= 2 && legacyName.length <= 60) {
            const { data: migratedProfile, error: migrationSaveError } = await client
              .from("studylab_profiles")
              .upsert({
                id: user.id,
                display_name: legacyName,
                updated_at: new Date().toISOString()
              }, { onConflict: "id" })
              .select("id,display_name,school,phone,exam_year,study_stream,gender,profile_completed_at,created_at,updated_at")
              .single();
            if (migrationSaveError) throw migrationSaveError;
            profile = migratedProfile;
            localStorage.removeItem("studyLabProfile");
          }
        }
      } catch (migrationError) {
        console.warn("StudyLab profile migration:", migrationError);
      }
    }

    /*
     * Every anonymous StudyLab account gets a cloud profile row.
     * A stable placeholder name is used until the student chooses
     * a display name. The UUID and AI quota identity are unchanged.
     */
    if (!profile) {
      try {
        await ensureProfileRow();
      } catch (profileError) {
        console.warn("StudyLab default profile:", profileError);
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

  // Anonymous sign-in happens automatically. Incomplete profiles are sent to
  // the profile form before entering pages that initialise a StudyLab account.
  ready.then(async function () {
    const path = window.location.pathname;
    if (path === "/" || path.endsWith("/index.html")) return;
    const currentProfile = await getProfile(true);
    if (isProfileComplete(currentProfile)) return;
    const returnTo = path + window.location.search + window.location.hash;
    window.location.replace("/index.html?completeProfile=1&returnTo=" + encodeURIComponent(returnTo));
  }).catch(function (error) {
    console.warn("StudyLab required profile gate:", error);
  });
})();
