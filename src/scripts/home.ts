// Page behaviour: renders the player bar, the lists and the sheets from the shared player state.
import * as player from "./player";
import type { Episode, HistoryItem, PlayerState } from "./player";

const SITE = "https://www.estampasandinas.com";
const q = <T extends HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
const qa = <T extends HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

const page = q<HTMLElement>("[data-page]")!;
const bar = q<HTMLElement>("[data-bar]")!;
const FALLBACK_ART = bar.dataset.fallbackArt!;

const el = {
  toggle: q<HTMLButtonElement>("[data-toggle]")!,
  art: q<HTMLImageElement>("[data-art]")!,
  chip: q<HTMLElement>("[data-chip]")!,
  chipText: q<HTMLElement>("[data-chip-text]")!,
  chipDot: q<HTMLElement>("[data-chip-dot]")!,
  title: q<HTMLElement>("[data-title]")!,
  sub: q<HTMLElement>("[data-sub]")!,
  goLive: q<HTMLButtonElement>("[data-golive]")!,
  volume: q<HTMLInputElement>("[data-volume]")!,
  waLabel: q<HTMLElement>("[data-wa-label]")!,
  progress: q<HTMLElement>("[data-progress]")!,
  seek: q<HTMLInputElement>("[data-seek]")!,
  pill: q<HTMLElement>("[data-pill]")!,
  pillText: q<HTMLElement>("[data-pill-text]")!,
  pillDot: q<HTMLElement>("[data-pill-dot]")!,
  qualityBtn: q<HTMLButtonElement>('[data-open="quality"]')!,
  qualityNormal: q<HTMLInputElement>('[data-quality-opt="normal"] input')!,
  qualitySaver: q<HTMLInputElement>('[data-quality-opt="saver"] input')!,
  saverKbps: q<HTMLElement>("[data-saver-kbps]")!,
  liveBox: q<HTMLElement>("[data-livebox]")!,
  liveWho: q<HTMLElement>("[data-live-who]")!,
  nextLine: q<HTMLElement>("[data-nextline]")!,
  mKicker: q<HTMLElement>("[data-m-kicker]")!,
  episodes: q<HTMLElement>("[data-episodes]")!,
  episodesMore: q<HTMLButtonElement>("[data-episodes-more]")!,
  history: q<HTMLElement>("[data-history]")!,
  historyMore: q<HTMLButtonElement>("[data-history-more]")!,
};

const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

// ---------- next broadcast: Sundays 7:00-9:00 (Peru time, UTC-5, no daylight saving) ----------
function nextShow(): string {
  const lima = new Date(Date.now() - 5 * 3600 * 1000);
  const day = lima.getUTCDay();
  const mins = lima.getUTCHours() * 60 + lima.getUTCMinutes();
  if (day === 0 && mins >= 7 * 60 && mins < 9 * 60) return "hoy, 7 a 9 a. m.";
  let diff = ((7 - day) % 7) * 1440 + 7 * 60 - mins;
  if (diff <= 0) diff += 7 * 1440;
  const d = Math.floor(diff / 1440);
  const h = Math.floor((diff % 1440) / 60);
  const m = diff % 60;
  const wait = d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
  return `domingo 7:00 a. m. · en ${wait}`;
}

// ---------- sheets and popovers ----------
let openName: string | null = null;
// Only move focus into a sheet when it was opened from the keyboard.
let usingKeyboard = false;
document.addEventListener("keydown", () => (usingKeyboard = true), true);
document.addEventListener("pointerdown", () => (usingKeyboard = false), true);
let opener: HTMLElement | null = null;
const popovers = qa("[data-pop]");
const sheetPanels = qa("[data-sheet-panel]");

function setSheet(name: string | null, from?: HTMLElement) {
  openName = name;
  page.dataset.sheet = name ?? "";
  popovers.forEach((p) => (p.hidden = p.dataset.pop !== name));
  qa("[data-open]").forEach((b) =>
    b.setAttribute("aria-expanded", String(b.dataset.open === name)),
  );
  if (name) {
    opener = from ?? opener;
    const target =
      popovers.find((p) => p.dataset.pop === name) ||
      sheetPanels.find((p) => p.dataset.sheetPanel === name);
    const focusable =
      q<HTMLElement>("[data-close]", target ?? document) ||
      q<HTMLElement>("input:checked, button, a", target ?? document);
    if (usingKeyboard && target && target.offsetParent !== null) focusable?.focus();
  } else if (opener) {
    opener.focus();
    opener = null;
  }
}
qa("[data-open]").forEach((b) =>
  b.addEventListener("click", () => setSheet(openName === b.dataset.open ? null : b.dataset.open!, b)),
);
qa("[data-close]").forEach((b) => b.addEventListener("click", () => setSheet(null)));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openName) setSheet(null);
});
document.addEventListener("pointerdown", (e) => {
  if (!openName) return;
  const t = e.target as Element;
  if (!t.closest("[data-pop], [data-sheet-panel], [data-open]")) setSheet(null);
});

// ---------- copy link ----------
qa("[data-copy]").forEach((b) =>
  b.addEventListener("click", async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(SITE);
    } catch {
      ok = false;
      window.prompt("Copia este enlace:", SITE);
    }
    if (!ok) return;
    qa("[data-copy-label]").forEach((l) => (l.textContent = "¡Copiado!"));
    setTimeout(() => qa("[data-copy-label]").forEach((l) => (l.textContent = "Copiar enlace")), 2000);
  }),
);

// ---------- controls ----------
el.toggle.addEventListener("click", () => player.toggle());
el.goLive.addEventListener("click", () => void player.playLive());
el.volume.value = String(player.getState().volume);
el.volume.addEventListener("input", () => player.setVolume(Number(el.volume.value)));
let seeking = false;
el.seek.addEventListener("input", () => {
  seeking = true;
  player.seek(Number(el.seek.value) / 1000);
});
el.seek.addEventListener("change", () => (seeking = false));
el.qualityNormal.addEventListener("change", () => player.setSaver(false));
el.qualitySaver.addEventListener("change", () => player.setSaver(true));

// keep the floating sheets above the bar
if ("ResizeObserver" in window) {
  new ResizeObserver(() =>
    page.style.setProperty("--bar-h", `${Math.ceil(bar.getBoundingClientRect().height)}px`),
  ).observe(bar);
}

// ---------- lists ----------
const dateFmt = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Lima" });
const shortDate = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "America/Lima" });
const timeFmt = new Intl.DateTimeFormat("es-PE", { hour: "numeric", minute: "2-digit", timeZone: "America/Lima" });
function ago(playedAt: number) {
  const mins = Math.round((Date.now() / 1000 - playedAt) / 60);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const d = new Date(playedAt * 1000);
  return `${shortDate.format(d)}, ${timeFmt.format(d)}`;
}
function setArt(img: HTMLImageElement, url: string | null) {
  if (url) {
    img.src = url;
    img.classList.remove("ea-art-fallback");
  } else {
    img.src = FALLBACK_ART;
    img.classList.add("ea-art-fallback");
  }
}

// Recently played
const VISIBLE_SONGS = 5;
let historyExpanded = false;
let renderedHistory: HistoryItem[] | null = null;
let renderedMinute = -1;
function renderHistory(items: HistoryItem[]) {
  renderedHistory = items;
  renderedMinute = Math.floor(Date.now() / 60000);
  el.history.textContent = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "ea-empty";
    li.textContent = "Todavía no hay canciones en el historial.";
    el.history.append(li);
    el.historyMore.hidden = true;
    return;
  }
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "ea-row";
    li.hidden = !historyExpanded && index >= VISIBLE_SONGS;
    const thumb = document.createElement("div");
    thumb.className = "ea-thumb";
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    setArt(img, null);
    thumb.append(img);
    if (!li.hidden) void player.resolveArt(item.song.art).then((r) => r && setArt(img, r));
    const text = document.createElement("div");
    text.className = "ea-row-text";
    const title = document.createElement("div");
    title.className = "ea-row-title";
    title.textContent = item.song.title || item.song.text || "—";
    text.append(title);
    if (item.song.artist) {
      const artist = document.createElement("div");
      artist.className = "ea-row-sub";
      artist.textContent = item.song.artist;
      text.append(artist);
    }
    const time = document.createElement("div");
    time.className = "ea-row-time";
    time.textContent = ago(item.played_at);
    li.append(thumb, text, time);
    el.history.append(li);
  });
  const extra = items.length - VISIBLE_SONGS;
  el.historyMore.hidden = extra <= 0;
  el.historyMore.textContent = historyExpanded ? "Ver menos" : `Ver ${extra} canciones anteriores`;
  el.historyMore.setAttribute("aria-expanded", String(historyExpanded));
}
el.historyMore.addEventListener("click", () => {
  historyExpanded = !historyExpanded;
  renderHistory(renderedHistory ?? []);
});

// Recorded shows
const VISIBLE_EPISODES = 6;
let episodesExpanded = false;
let renderedEpisodes: Episode[] | null = null;
const episodeRows = new Map<string, { li: HTMLElement; btn: HTMLButtonElement }>();
function renderEpisodes(items: Episode[]) {
  renderedEpisodes = items;
  episodeRows.clear();
  el.episodes.textContent = "";
  items.forEach((ep, index) => {
    const li = document.createElement("li");
    li.className = "ea-row";
    li.hidden = !episodesExpanded && index >= VISIBLE_EPISODES;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ea-ep-btn";
    btn.setAttribute("aria-label", `Escuchar programa: ${ep.title}`);
    btn.innerHTML =
      '<svg class="ea-icon-play" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z" fill="currentColor"></path></svg>' +
      '<svg class="ea-icon-pause" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"></rect><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"></rect></svg>';
    btn.addEventListener("click", () => void player.playEpisode(ep));
    const text = document.createElement("div");
    text.className = "ea-row-text";
    const title = document.createElement("div");
    title.className = "ea-row-title";
    title.textContent = ep.title;
    const meta = document.createElement("div");
    meta.className = "ea-row-sub";
    meta.textContent = [dateFmt.format(new Date(ep.publish_at * 1000)), ep.media?.length_text]
      .filter(Boolean)
      .join(" · ");
    text.append(title, meta);
    li.append(btn, text);
    el.episodes.append(li);
    episodeRows.set(ep.id, { li, btn });
  });
  const extra = items.length - VISIBLE_EPISODES;
  el.episodesMore.hidden = extra <= 0;
  el.episodesMore.textContent = episodesExpanded ? "Ver menos" : `Ver ${extra} programas más`;
  el.episodesMore.setAttribute("aria-expanded", String(episodesExpanded));
}
el.episodesMore.addEventListener("click", () => {
  episodesExpanded = !episodesExpanded;
  renderEpisodes(renderedEpisodes ?? []);
});

// ---------- main render ----------
function render(s: PlayerState) {
  const episodeMode = s.mode === "episode" && s.episode;
  const live = s.online && s.isLive;
  page.classList.toggle("is-playing", s.playing);
  page.classList.toggle("needs-tap", s.needsTap && !s.playing);
  page.dataset.mode = s.mode;

  // play button
  el.toggle.setAttribute(
    "aria-label",
    s.playing ? "Pausar" : episodeMode ? "Reproducir programa" : "Reproducir en vivo",
  );
  el.toggle.setAttribute("aria-busy", String(s.loading));

  // status chip (bar) and pill (mobile header)
  const chipLabel = episodeMode ? "GRABADO" : !s.online ? "FUERA DE LÍNEA" : live ? "EN VIVO" : "MÚSICA 24 H";
  el.chipText.textContent = chipLabel;
  el.chip.classList.toggle("is-live", !episodeMode && live);
  el.chip.classList.toggle("is-offline", !episodeMode && !s.online);
  el.chipDot.hidden = !(!episodeMode && live);
  const pillLabel = !s.online ? "FUERA DE LÍNEA" : live ? "EN VIVO" : "MÚSICA 24 H";
  el.pillText.textContent = pillLabel;
  el.pill.classList.toggle("is-live", live);
  el.pill.classList.toggle("is-offline", !s.online);
  el.pillDot.hidden = !live;

  // title / subtitle / art
  const listeners = s.listeners > 0 ? ` · ${s.listeners} escuchando` : "";
  if (episodeMode) {
    el.title.textContent = s.episode!.title;
    el.sub.textContent = `Programa anterior · ${fmt(s.elapsed)} / ${s.duration ? fmt(s.duration) : "--:--"}`;
    setArt(el.art, null);
  } else {
    el.title.textContent = s.title;
    el.sub.textContent = s.error
      ? s.error
      : s.needsTap && !s.playing
        ? "Toca el botón verde"
        : (live ? `En vivo con ${s.streamer || "Orestes Damián"}` : s.artist || "Estampas Andinas") + listeners;
    if (el.art.dataset.src !== (s.art ?? "")) {
      el.art.dataset.src = s.art ?? "";
      setArt(el.art, s.art);
    }
  }
  el.sub.classList.toggle("is-error", !!s.error);
  el.goLive.hidden = !episodeMode;
  el.waLabel.textContent = live && !episodeMode ? "Manda tu saludo" : "Saludar";

  // progress and seek
  const frac = s.duration ? Math.min(1, s.elapsed / s.duration) : 0;
  el.progress.style.width = `${frac * 100}%`;
  el.seek.hidden = !episodeMode;
  if (episodeMode && !seeking) el.seek.value = String(Math.round(frac * 1000));

  // quality (only when the server has a lower-bitrate mount)
  el.qualityBtn.hidden = !s.lowMount;
  if (s.lowMount) {
    el.saverKbps.textContent = `· ${s.lowMount.bitrate} kbps`;
    el.qualitySaver.checked = s.saver;
    el.qualityNormal.checked = !s.saver;
    qa("[data-quality-opt]").forEach((l) =>
      l.classList.toggle("is-on", (l.dataset.qualityOpt === "saver") === s.saver),
    );
  } else if (openName === "quality") {
    setSheet(null);
  }

  // hero: live box or next show
  el.liveBox.hidden = !live;
  el.liveWho.textContent = s.streamer || "Orestes Damián";
  el.nextLine.hidden = live;
  const next = nextShow();
  qa("[data-next]").forEach((n) => (n.textContent = next));
  el.mKicker.textContent = live ? `En vivo ahora · ${s.streamer || "Orestes Damián"}` : `Próximo en vivo: ${next}`;
  el.mKicker.classList.toggle("is-live", live);

  // lists
  if (renderedHistory !== s.history || renderedMinute !== Math.floor(Date.now() / 60000)) {
    renderHistory(s.history);
  }
  if (renderedEpisodes !== s.episodes) {
    renderEpisodes(s.episodes);
    qa("[data-needs-episodes]").forEach((n) => (n.hidden = s.episodes.length === 0));
    qa('[data-open="episodes"]').forEach((n) => (n.hidden = s.episodes.length === 0));
  }
  episodeRows.forEach((row, id) => {
    const active = !!episodeMode && s.episode!.id === id;
    row.li.classList.toggle("is-active", active);
    row.li.classList.toggle("is-playing", active && s.playing);
    row.btn.setAttribute("aria-pressed", String(active && s.playing));
  });
}

player.subscribe(render);
// episode buttons of the mobile bar are hidden until shows exist
qa('[data-open="episodes"]').forEach((n) => (n.hidden = true));
player.init();
