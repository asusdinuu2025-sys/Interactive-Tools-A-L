# StudyLab Announcements: administrator guide

## Access
Only the three approved StudyLab admin accounts can publish, edit or delete banners or upload banner images:
- `dinushahemal529@gmail.com`
- `asusdinuu2025@gmail.com`
- `dinushahemal4444@gmail.com`

In the **Home** header, open **your profile menu → Manage announcements**. Students can open **Announcements** to view published history, but they cannot edit posts. No per-student announcement read/click tracking is used.

## Create a banner
1. Select **New post** or **Edit** beside an existing entry.
2. Enter a **Headline** and **Short message**. Both remain in announcement history, even if you choose image-only display. Fill **Button text** to provide an accessible destination name.
3. Set **Slide order** (10, 20, 30; smaller numbers appear earlier).
4. Choose **Open when clicked** from the built-in StudyLab destinations, or select **Any website or StudyLab link…**. Paste a URL, such as `https://example.com/page`, or an internal StudyLab path, such as `/physics.html`. A domain without a scheme gets `https://` added automatically. External sites open in a separate tab. Only standard `http://` and `https://` links are accepted; scripts and other URL schemes are blocked.
5. Choose **Banner layout**:
   - **Normal: headline and button:** retains StudyLab's text overlay and optional SVG illustration.
   - **Image only: clean artwork / ad:** shows the uploaded picture edge-to-edge without the headline, button or decoration layered over it. The picture remains clickable. An image is required for this mode.
6. Choose **Decorative illustration:** Profile, Community, Chat, Science, StudyLab, Megaphone, or **None**. Selecting None removes the SVG decoration.
7. Choose **Transition effect** per banner:
   - **Soft fade** (default)
   - **Slide away**
   - **Soft dissolve / dust**
   - **Soft zoom out**
   - **None: instant change** (no animation)
8. Adjust **Display time** from **1 to 10 seconds**, independently for each banner (default **4 seconds**).
9. Optionally set **Publish from** or **Expire at**. Check **Publish this banner** to make it available and click **Publish / Save**.

## Upload a picture and select what to crop
- **Recommended file:** 1200 × 480 px, a 2.5:1 landscape ratio.
- **Accepted files:** JPG, PNG or WebP, original file no more than 8 MB.
- StudyLab produces a 1200 × 480 WebP file, maximum 2 MB, in the dedicated Supabase bucket `studylab-announcements`.
- After selecting an original image, the editor shows the **full original photo** with a cyan 2.5:1 cropping rectangle. **Drag the rectangle** over the important area.
- Use **Crop zoom (1×–3×)** to include less of the original image. Hold **Shift + Arrow** keys to move the crop more quickly; the arrow keys alone make smaller adjustments.
- Check the **final crop preview** below the selector; it shows the area that will be uploaded.
- Choose **Image only** to show an advertisement or graphic cleanly, with no extra text/decoration.
- Cropping is performed in your browser before uploading and does not modify your original file.
- To re-crop a previously uploaded image and recover areas outside the old crop, choose its **original file again**. A previously compressed 1200 × 480 upload cannot recover details that were cropped away.
- When creating ads, use artwork you have permission to publish, make the destination trustworthy, and clearly disclose paid sponsorship as required.

## Manage existing banners
- **Edit:** choose **Edit**, change details, effects, time, image or destination, then save.
- **Reorder:** edit Slide order. Duplicate order numbers are allowed; older posts appear first on ties.
- **Replace image:** upload a new original, drag/zoom the crop and save. The previous image is cleaned up after the database save succeeds.
- **Remove image:** select **Remove image and use illustration**, switch back to Normal layout if necessary and save.
- **No effects:** choose **None** for decorative illustration, **None: instant change** for transition and (with a picture uploaded) **Image only** for the layout.
- **Hide without deleting:** uncheck **Publish this banner** and save as a draft.
- **Delete permanently:** select **Delete**, confirm, and the post/image will be removed.
- **Announcements history:** current and expired published posts remain visible through the profile dropdown. Drafts/future posts stay admin-only.

## Carousel behavior
Each live banner uses its own **Display time** (1–10 seconds). Auto-rotation pauses while hovered/being interacted with, when the carousel is off-screen, or if reduced-motion settings request no automatic animation. Previous/next arrows and navigation dots continue working manually. The glass dashboard, long-name greeting, Social, pet and Study Room features are unchanged.

**Security:** Banner creation/updates/deletion and image storage are protected by Supabase row-level security and the same three-account admin allowance. External URL validation allows only HTTP(S), disallows embedded credentials and does not permit executable URL schemes. No ads are automatically added by this upgrade.
