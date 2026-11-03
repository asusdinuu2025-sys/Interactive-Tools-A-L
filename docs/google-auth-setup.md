# StudyLab Google authentication setup

The welcome screen uses Supabase Auth with Google OAuth. Keep the Google client secret in Supabase only. Never place it in this repository or browser JavaScript.

## Google Cloud
1. Create a Web application OAuth client in Google Auth Platform.
2. Add `https://studylablk.netlify.app` as an authorized JavaScript origin.
3. Add the exact Netlify Deploy Preview origin used for testing as another authorized JavaScript origin when needed.
4. Add this authorized redirect URI: `https://zpvatyxdbshjuqgtexzw.supabase.co/auth/v1/callback`.
5. Save the OAuth client ID and client secret.

## Supabase
1. Open project `zpvatyxdbshjuqgtexzw` → Authentication → Sign In / Providers → Google.
2. Enable Google and enter the OAuth client ID and client secret.
3. Under Authentication → URL Configuration, set the Site URL to `https://studylablk.netlify.app`.
4. Add `https://studylablk.netlify.app/` and the exact Deploy Preview URL used for testing to the redirect allow list. Netlify previews may use `https://deploy-preview-*--studylablk.netlify.app/**`.

## Behaviour
- Existing saved Google and Guest sessions bypass the welcome screen.
- Visitors without a session see New User, Existing User, and Continue as Guest.
- New Google accounts receive the existing StudyLab profile-completion window, with the Google display name prefilled when available.
- Existing Google accounts log in normally. If the Google identity has no StudyLab profile, the visitor returns to the login screen and can choose New User.
- Guest sessions remain anonymous and are not silently linked to Google.
- Existing profile fields and Study Room completion requirements are unchanged.
- Google OAuth itself does not require StudyLab to send SMS or verification emails.

Google must be enabled in Supabase before the Google buttons can complete sign-in.