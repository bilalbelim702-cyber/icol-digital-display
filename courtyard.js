"use strict";

const names = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const zone = "America/New_York";
const clockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
});
const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: zone, weekday: "long", month: "long", day: "numeric", year: "numeric"
});
const hijriFormat = new Intl.DateTimeFormat("en-US-u-ca-islamic-civil", {
  timeZone: zone, day: "numeric", month: "long", year: "numeric"
});
const byId = (id) => document.getElementById(id);
const cards = new Map();
let schedule = null;
let scheduleStatus = "Loading schedule…";

for (const name of names) {
  const card = document.createElement("tr");
  card.innerHTML = '<th scope="row"></th><td>—</td><td><span class="pill">—</span></td>';
  card.querySelector("th").textContent = name;
  byId("prayers").append(card);
  cards.set(name, card);
}

function parseTime(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatTime(minutes) {
  if (minutes === null) return "—";
  const hour = Math.floor(minutes / 60);
  const minute = String(minutes % 60).padStart(2, "0");
  return (hour % 12 || 12) + ":" + minute + (hour < 12 ? " AM" : " PM");
}

function normalizeSchedule(data) {
  if (!data || !data.prayers || !Array.isArray(data.announcements)) {
    throw new Error("Invalid schedule");
  }
  const prayers = names.map((name) => {
    const entry = data.prayers[name] || {};
    const adhan = parseTime(entry.adhan);
    const iqamah = parseTime(entry.iqamah);
    if ((entry.adhan && adhan === null) || (entry.iqamah && iqamah === null)) {
      throw new Error("Invalid prayer time for " + name);
    }
    return { name, adhan, iqamah };
  });
  const announcements = data.announcements
    .filter((message) => typeof message === "string" && message.trim())
    .map((message) => message.trim());
  const friday = data.jumuah || {};
  const khutbah = parseTime(friday.khutbah);
  const iqamah = parseTime(friday.iqamah);
  if ((friday.khutbah && khutbah === null) || (friday.iqamah && iqamah === null)) {
    throw new Error("Invalid Jumu’ah time");
  }
  return { prayers, announcements, friday: { khutbah, iqamah } };
}

function nextIqamah(prayers, seconds) {
  return prayers
    .filter((prayer) => prayer.iqamah !== null)
    .map((prayer) => {
      const wait = (86400 + prayer.iqamah * 60 - seconds) % 86400;
      return { ...prayer, wait, tomorrow: prayer.iqamah * 60 < seconds };
    })
    .sort((a, b) => a.wait - b.wait)[0];
}

function phaseForHour(hour) {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

function updateDisplay() {
  const now = new Date();
  const parts = clockFormat.formatToParts(now);
  const timePart = (type) => Number(parts.find((part) => part.type === type).value);
  const hour = timePart("hour");
  const minute = timePart("minute");
  const second = timePart("second");
  const seconds = hour * 3600 + minute * 60 + second;
  const twoDigits = (value) => String(value).padStart(2, "0");

  byId("clock").textContent = (hour % 12 || 12) + ":" + twoDigits(minute);
  byId("clock").dateTime = now.toISOString();
  byId("period").textContent = hour < 12 ? "AM" : "PM";
  byId("date").textContent = dateFormat.format(now);
  byId("hijri-date").textContent = hijriFormat.format(now);
  document.documentElement.dataset.phase = phaseForHour(hour);

  const next = nextIqamah(schedule ? schedule.prayers : [], seconds);
  for (const [name, card] of cards) {
    if (next && !next.tomorrow && name === next.name) card.setAttribute("aria-current", "true");
    else card.removeAttribute("aria-current");
  }
  byId("next-prayer").textContent = next ? next.name : "Schedule pending";
  byId("countdown").textContent = next
    ? (next.tomorrow ? "Tomorrow · " : "") + Math.floor(next.wait / 3600) + ":" +
      twoDigits(Math.floor(next.wait / 60) % 60) + ":" + twoDigits(next.wait % 60)
    : "";

  byId("next-time").hidden = !next;
  byId("next-time").textContent = next ? formatTime(next.iqamah) : "";

  const messages = schedule ? schedule.announcements : [];
  const announcement = messages[Math.floor(seconds / 15) % messages.length];
  const message = announcement || "No announcements at this time.";
  if (byId("announcement").textContent !== message) byId("announcement").textContent = message;
}

function setStatus(message) {
  if (scheduleStatus === message) return;
  scheduleStatus = message;
  byId("schedule-status").textContent = message;
}

async function loadSchedule() {
  try {
    const response = await fetch("schedule.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Schedule request failed");
    const updated = normalizeSchedule(await response.json());
    schedule = updated;
    for (const prayer of updated.prayers) {
      const [adhan, iqamah] = cards.get(prayer.name).querySelectorAll("td:first-of-type, .pill");
      adhan.textContent = formatTime(prayer.adhan);
      iqamah.textContent = formatTime(prayer.iqamah);
    }
    byId("khutbah").textContent = formatTime(updated.friday.khutbah);
    byId("jumuah-iqamah").textContent = formatTime(updated.friday.iqamah);
    const hasTimes = updated.prayers.some((prayer) => prayer.adhan !== null || prayer.iqamah !== null);
    setStatus(hasTimes ? "" : "Awaiting confirmed times");
  } catch (error) {
    setStatus(schedule ? "Update unavailable · showing last loaded times" : "Schedule unavailable");
    console.error(error);
  }
  updateDisplay();
  setTimeout(loadSchedule, 60000);
}

updateDisplay();
setInterval(updateDisplay, 1000);
loadSchedule();

