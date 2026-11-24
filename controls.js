"use strict";

const repo = "bilalbelim702-cyber/icol-digital-display";
const api = "https://api.github.com";
const schedulePath = "/repos/" + repo + "/contents/schedule.json";
const names = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const byId = (id) => document.getElementById(id);
let token = "";
let schedule = null;
let fileSha = "";
let busy = false;

function notice(message, kind = "") {
  byId("status").textContent = message;
  byId("status").dataset.kind = kind;
}

function syncButtons() {
  for (const id of ["unlock", "preview", "lock", "refresh"]) byId(id).disabled = busy;
  byId("save").disabled = busy || !token || !fileSha;
}

function setBusy(value) {
  busy = value;
  syncButtons();
}

class GitHubError extends Error {
  constructor(status) {
    super("GitHub request failed");
    this.status = status;
  }
}

async function github(path, accessToken, options = {}) {
  const response = await fetch(api + path, {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + accessToken,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers
    }
  });
  if (!response.ok) throw new GitHubError(response.status);
  return response.json();
}

function decodeBase64(content) {
  const bytes = Uint8Array.from(atob(content), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let characters = "";
  for (const byte of bytes) characters += String.fromCharCode(byte);
  return btoa(characters);
}

function checkSchedule(value) {
  if (!value || !value.prayers || !Array.isArray(value.announcements)) {
    throw new Error("Invalid schedule");
  }
  return value;
}

async function getSchedule(accessToken) {
  if (!accessToken) {
    const response = await fetch("schedule.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Schedule unavailable");
    return { data: checkSchedule(await response.json()), sha: "" };
  }
  const file = await github(schedulePath + "?ref=main", accessToken);
  if (file.type !== "file" || file.encoding !== "base64" || !file.sha) {
    throw new Error("Unexpected GitHub file response");
  }
  return { data: checkSchedule(JSON.parse(decodeBase64(file.content))), sha: file.sha };
}

function switchMaghribMode() {
  const afterSunset = byId("maghrib-mode").value === "sunset";
  byId("offset-field").hidden = !afterSunset;
  byId("maghrib-offset").required = afterSunset;
  byId("fixed-field").hidden = afterSunset;
}

function showSchedule(file) {
  schedule = file.data;
  fileSha = file.sha;
  for (const name of names) {
    const key = name.toLowerCase();
    const entry = schedule.prayers[name] || {};
    byId("adhan-" + key).value = entry.adhan || "";
    byId(key === "maghrib" ? "maghrib-fixed" : key).value = entry.iqamah || "";
  }
  const offset = schedule.prayers.Maghrib?.sunsetOffsetMinutes;
  byId("maghrib-mode").value = Number.isInteger(offset) ? "sunset" : "fixed";
  byId("maghrib-offset").value = offset ?? 10;
  byId("khutbah").value = schedule.jumuah?.khutbah || "";
  byId("friday-prayer").value = schedule.jumuah?.iqamah || "";
  byId("announcements").value = schedule.announcements.join("\n");
  byId("mode").textContent = token ? "Editing the ICOL schedule" : "Preview mode · changes stay on this screen";
  byId("access").hidden = true;
  byId("editor").hidden = false;
  switchMaghribMode();
  syncButtons();
}

function editedSchedule() {
  const data = { ...schedule, prayers: { ...schedule.prayers } };
  for (const name of names) {
    const key = name.toLowerCase();
    const previous = data.prayers[name] || {};
    const adhan = byId("adhan-" + key).value;
    const iqamah = byId(key === "maghrib" ? "maghrib-fixed" : key).value;
    const entry = { ...previous };
    if (adhan || Object.hasOwn(previous, "adhan")) entry.adhan = adhan;
    if (iqamah || Object.hasOwn(previous, "iqamah")) entry.iqamah = iqamah;
    if (name === "Maghrib") {
      if (byId("maghrib-mode").value === "sunset") {
        entry.sunsetOffsetMinutes = Number(byId("maghrib-offset").value);
        if (Object.hasOwn(entry, "iqamah")) entry.iqamah = "";
      } else {
        delete entry.sunsetOffsetMinutes;
      }
    }
    if (Object.keys(entry).length) data.prayers[name] = entry;
  }
  const jumuah = { ...data.jumuah };
  for (const [field, id] of [["khutbah", "khutbah"], ["iqamah", "friday-prayer"]]) {
    const value = byId(id).value;
    if (value || Object.hasOwn(jumuah, field)) jumuah[field] = value;
  }
  if (data.jumuah || Object.keys(jumuah).length) data.jumuah = jumuah;
  const text = byId("announcements").value;
  if (text !== schedule.announcements.join("\n")) {
    data.announcements = text.split("\n").map((line) => line.trim()).filter(Boolean);
  }
  return data;
}

function hasEdits() {
  return schedule && JSON.stringify(editedSchedule()) !== JSON.stringify(schedule);
}

function errorMessage(error, operation) {
  if (error.status === 401) return "GitHub rejected this token. Check that it is current and try again.";
  if (error.status === 403 || error.status === 404) {
    return "GitHub denied access. Check that the token is for icol-digital-display with Contents set to Read and write.";
  }
  if (operation === "save" && (error.status === 409 || error.status === 422)) {
    return "GitHub could not save this version. If someone else changed the schedule, copy your edits before reloading it.";
  }
  return operation === "save"
    ? "Could not confirm the save. Your edits are still here. Check the latest schedule before trying again."
    : "Could not load the schedule. Check your connection and try again.";
}

async function openEditor(accessToken) {
  setBusy(true);
  notice("Loading the ICOL schedule…");
  try {
    const file = await getSchedule(accessToken);
    token = accessToken;
    showSchedule(file);
    notice("");
    byId("lock").focus();
  } catch (error) {
    notice(errorMessage(error, "load"), "error");
    byId("status").scrollIntoView({ block: "nearest" });
  } finally {
    setBusy(false);
  }
}

async function saveSchedule(event) {
  event.preventDefault();
  if (busy || !token || !fileSha) return;
  if (!hasEdits()) {
    notice("No changes to save.");
    return;
  }
  const data = editedSchedule();
  if (data.jumuah?.khutbah && data.jumuah?.iqamah && data.jumuah.khutbah > data.jumuah.iqamah) {
    notice("Set Friday Salah at or after the Khutbah time.", "error");
    return;
  }
  setBusy(true);
  notice("Saving to GitHub…");
  try {
    const result = await github(schedulePath, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch: "main",
        sha: fileSha,
        message: "Update ICOL schedule from board controls",
        content: encodeBase64(JSON.stringify(data, null, 2) + "\n")
      })
    });
    if (!result.content?.sha) throw new Error("Incomplete save response");
    fileSha = result.content.sha;
    schedule = data;
    notice("Saved to GitHub. The TV will pick this up after GitHub Pages publishes the update.");
  } catch (error) {
    notice(errorMessage(error, "save"), "error");
  } finally {
    setBusy(false);
  }
}

function lockEditor() {
  token = "";
  schedule = null;
  fileSha = "";
  busy = false;
  byId("schedule-form").reset();
  byId("unlock-form").reset();
  byId("editor").hidden = true;
  byId("access").hidden = false;
  syncButtons();
  notice("");
}

byId("unlock-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (busy) return;
  const value = byId("token").value.trim();
  if (!/^github_pat_[a-zA-Z0-9_]+$/.test(value)) {
    notice("Enter a fine-grained GitHub token. It starts with github_pat_.", "error");
    return;
  }
  byId("token").value = "";
  openEditor(value);
});
byId("preview").addEventListener("click", () => {
  if (!busy) openEditor("");
});
byId("maghrib-mode").addEventListener("change", switchMaghribMode);
byId("schedule-form").addEventListener("submit", saveSchedule);
byId("refresh").addEventListener("click", () => {
  if (!busy && (!hasEdits() || confirm("Reload the schedule and discard unsaved edits?"))) openEditor(token);
});
byId("lock").addEventListener("click", () => {
  if (hasEdits() && !confirm("Lock the editor and discard unsaved edits?")) return;
  lockEditor();
  byId("token").focus();
});
window.addEventListener("pagehide", lockEditor);
