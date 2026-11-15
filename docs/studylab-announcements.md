# StudyLab announcement banners: admin guide

## Who can publish?
Only these three verified Admin accounts:
- dinushahemal529@gmail.com
- asusdinuu2025@gmail.com
- dinushahemal4444@gmail.com

Anonymous users and other accounts cannot publish, edit, delete or upload banners. Students can view published posts, but no student read, click, or dismissal records are saved.

## Create an announcement
1. Sign into the StudyLab Home page with an approved admin account.
2. Open the profile dropdown at the top and choose Manage announcements.
3. Select New post (or Edit beside an existing post).
4. Choose Post type, Headline, Short message and Button text.
5. Set Open when clicked to the destination. Choose Another StudyLab page only for an internal path, such as /physics.html or /#social.
6. Select a default SVG illustration or upload your own banner image.
7. Choose Slide order: smaller numbers appear first (10, 20, 30). Put 15 between 10 and 20.
8. Set optional Publish from and Expire at dates. Tick Publish this banner when ready, or leave it unticked to keep a draft.
9. Click Publish / Save. New posts appear on the Home carousel when published and within their scheduled dates.

## Create and upload a custom image
- Create a landscape image measuring 1200 x 480 pixels (2.5:1 ratio).
- Upload JPG, PNG or WebP files up to 8 MB originally.
- StudyLab automatically center-crops, resizes to 1200 x 480, and converts to WebP, at most 2 MB.
- The upload is previewed before you publish. If no custom image is uploaded, the chosen theme-matching SVG artwork appears.
- Place important visual details toward the center/right. The left side receives a glass-gradient overlay so the website headline remains legible. Avoid adding duplicate text into the image itself.
- Phone screens may crop parts of the image edges because the banner is narrower.
- Custom banner images are stored in the dedicated public Supabase Storage bucket: studylab-announcements. Only the three administrators can upload/delete its objects.

## Manage existing posts
- Edit: Select Edit beside a post, make changes and save.
- Replace image: Edit, choose a new JPG/PNG/WebP and save. The old image is cleaned up after the replacement is safely stored.
- Remove image only: Edit, select Remove uploaded image and use SVG, then save.
- Hide: Edit, uncheck Publish this banner and save. It becomes a draft, not visible to students.
- Delete: Select Delete next to the post, and confirm. It will be removed from the carousel and the corresponding image cleaned from storage.
- Reorder: Edit the Slide order number and save. Duplicate numbers are permitted; older posts sort first if their order numbers match.
- To move an expired banner back into rotation, update its expiry date or clear it and republish.

## What students see
- The Home carousel rotates once every 4 seconds, with manual previous/next arrows and navigation dots.
- Auto-rotation pauses during interaction, when the carousel is outside the viewport, or if reduced motion is requested.
- Clicking a banner opens its chosen internal StudyLab destination, including profile, study room, Social, Chat, simulations or About StudyLab.
- Current and old published announcements are available through Profile > Announcements.
- Draft, future scheduled and expired banners do not appear in the rotating carousel.
- No forced login popup, no ads and no student read-tracking system.

## Implementation
- Announcements table: public.studylab_announcements (with RLS).
- Previous student receipts table: dropped.
- Banner images: dedicated public WebP Storage bucket, max 2 MB; admin insert/delete restricted by RLS and the exact three-account UUID allowlist.
- No Netlify Functions required for banner delivery.
