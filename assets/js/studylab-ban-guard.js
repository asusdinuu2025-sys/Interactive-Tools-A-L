/* Display a clear account-suspension notice and end banned sessions.
   The actual sign-in ban is set by the secured Supabase Auth admin API. */
(function () {
  "use strict";
  async function verify() {
    const client = window.StudyLabAccount?.client;
    if (!client) return;
    try {
      await window.StudyLabAccount?.startup;
      const user = (await client.auth.getUser()).data?.user;
      if (!user?.id || user.is_anonymous) return;
      const result = await client.rpc("studylab_user_ban_status");
      if (result.error || result.data?.banned !== true) return;
      window.StudyLabBanned = true;
      await client.auth.signOut({ scope: "local" });
      const banner = document.createElement("div");
      banner.className = "slban-notice";
      banner.setAttribute("role","alert");
      const until = result.data.expires_at ?
        " until " + new Date(result.data.expires_at).toLocaleString() : "";
      const title = document.createElement("strong");
      title.textContent = "StudyLab account suspended";
      const message = document.createElement("p");
      message.textContent = "Sign-in access for this account is suspended" +
        until + ". Contact a StudyLab administrator if you believe this is incorrect.";
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "Close";
      close.onclick = () => banner.remove();
      banner.append(title,message,close);
      document.body.append(banner);
    } catch (_) { /* Public pages remain accessible even if Auth is offline. */ }
  }
  window.StudyLabBanGuardReady = verify();
})();
