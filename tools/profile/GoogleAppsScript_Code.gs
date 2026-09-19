/*
 * Study-Lab Profile Name List
 *
 * Google Sheets + Apps Script backend for the simple profile system.
 * Stores: Timestamp, Profile ID, Name
 *
 * Setup:
 * 1. Create a Google Sheet named "Study-Lab Profiles".
 * 2. Open Extensions -> Apps Script.
 * 3. Paste this code and deploy it as a Web app.
 * 4. Set "Who has access" to "Anyone".
 * 5. Copy the Web app URL into assets/js/profile.js:
 *      const PROFILE_ENDPOINT = "YOUR_WEB_APP_URL";
 */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Profiles");

  if (!sheet) {
    sheet = ss.insertSheet("Profiles");
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Profile ID", "Name"]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function cleanText_(value, maxLength) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function doPost(e) {
  const sheet = getSheet_();

  let data = {};
  try {
    data = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "Invalid request" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const id = cleanText_(data.id, 100);
  const name = cleanText_(data.name, 60);

  if (!id || name.length < 2) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: "Name and ID are required" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const finder = sheet.createTextFinder(id).matchEntireCell(true);
  const existing = finder.findNext();

  if (existing) {
    sheet.getRange(existing.getRow(), 1, 1, 3)
      .setValues([[new Date(), id, name]]);
  } else {
    sheet.appendRow([new Date(), id, name]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService
    .createTextOutput("Study-Lab Profile service is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}
