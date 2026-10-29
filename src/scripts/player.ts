// Single audio player for the whole page: the live stream and the recorded shows.
// UI scripts subscribe to the state and call the actions; nothing here touches the DOM.
import { NOW_PLAYING_URL, PODCASTS_URL, STREAM_URL } from "../components/radio/config";

export type Song = { title?: string; artist?: string; text?: string; art?: string };
export type HistoryItem = { played_at: number; song: Song };
export type Episode = {
  id: string;
  title: string;
  description_short?: string;
  publish_at: number;
  is_published?: boolean;
  has_media?: boolean;
  media?: { length_text?: string; length?: number } | null;
  links: { download: string };
};
type Mount = { url: string; bitrate: number; is_default?: boolean };
type Podcast = { links: { episodes: string }; is_published?: boolean };

export type PlayerState = {
  mode: "live" | "episode";
  playing: boolean;
  loading: boolean;
  online: boolean;
  isLive: boolean;
  streamer: string;
  title: string;
  artist: string;
  art: string | null;
  listeners: number;
  duration: number;
  elapsed: number;
  history: HistoryItem[];
  episodes: Episode[];
  episodesLoaded: boolean;
  episode: Episode | null;
  lowMount: { url: string; bitrate: number } | null;
  saver: boolean;
  needsTap: boolean;
  error: string;
  volume: number;
};

// ---------- helpers ----------
const conn = (navigator as unknown as {
  connection?: { saveData?: boolean; effectiveType?: string };
}).connection;
export const slowNet = () =>
  !!conn && (!!conn.saveData || /(^|-)[23]g$/.test(conn.effectiveType || ""));
export const verySlowNet = () =>
  !!conn && (!!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""));

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

// ---------- state ----------
const savedVolume = store.get("ea-volume");
const state: PlayerState = {
  mode: "live",
  playing: false,
  loading: false,
  online: true,
  isLive: false,
  streamer: "",
  title: "Estampas Andinas",
  artist: "Música andina, huaynos tarmeños y más",
  art: null,
  listeners: 0,
  duration: 0,
  elapsed: 0,
  history: [],
  episodes: [],
  episodesLoaded: false,
  episode: null,
  lowMount: null,
  saver: false,
  needsTap: false,
  error: "",
  volume: savedVolume !== null && savedVolume !== "" ? Number(savedVolume) || 0 : 80,
};

const listeners = new Set<(s: PlayerState) => void>();
export const getState = () => state;
export function subscribe(fn: (s: PlayerState) => void) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((fn) => fn(state));
}

const audio = new Audio();
audio.preload = "none";
audio.volume = state.volume / 100;

let defaultStream = STREAM_URL;
let baseElapsed = 0;
let fetchedAt = Date.now();
let songDuration = 0;
let currentId: string | number | null = null;
let userStopped = false;
const saverPref = () => store.get("ea-saver"); // "1" | "0" | null (= automatic)
const wantsSaver = () => saverPref() === "1" || (saverPref() === null && slowNet());
state.saver = wantsSaver();

// ---------- album art ----------
const artCache = new Map<string, Promise<string | null>>();
// AzuraCast answers with its own generic cover when a song has no art, so resolve it once
// and fall back to our logo in that case. Skipped on 2G / Data Saver.
export function resolveArt(url?: string): Promise<string | null> {
  if (!url || verySlowNet()) return Promise.resolve(null);
  let hit = artCache.get(url);
  if (!hit) {
    hit = fetch(url)
      .then(async (res) => {
        if (!res.ok || res.url.includes("generic_song")) {
          if (res.body && res.body.cancel) void res.body.cancel();
          return null;
        }
        return URL.createObjectURL(await res.blob());
      })
      .catch(() => null);
    artCache.set(url, hit);
  }
  return hit;
}

// ---------- playback ----------
const liveUrl = () => (state.saver && state.lowMount ? state.lowMount.url : defaultStream);

async function startAudio(src: string, auto = false) {
  state.error = "";
  state.needsTap = false;
  state.loading = true;
  emit();
  audio.src = src;
  try {
    await audio.play(); // old browsers return undefined, which await accepts
  } catch {
    state.loading = false;
    state.playing = false;
    audio.removeAttribute("src");
    if (auto) {
      state.needsTap = true;
      armFirstGesture();
    } else {
      state.error = "No se pudo reproducir. Intenta de nuevo en unos segundos.";
    }
    emit();
  }
}

export async function playLive(auto = false) {
  disarmFirstGesture();
  userStopped = false;
  state.mode = "live";
  state.episode = null;
  state.duration = songDuration;
  // Reload so we join the live edge instead of resuming a stale buffer.
  await startAudio(`${liveUrl()}?t=${Date.now()}`, auto);
}

export async function playEpisode(ep: Episode) {
  disarmFirstGesture();
  userStopped = true;
  if (state.mode === "episode" && state.episode?.id === ep.id) {
    toggle();
    return;
  }
  state.mode = "episode";
  state.episode = ep;
  state.duration = ep.media?.length || 0;
  state.elapsed = 0;
  await startAudio(ep.links.download);
  setMediaSession();
}

export function stop() {
  disarmFirstGesture();
  userStopped = true;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  state.playing = false;
  state.loading = false;
  state.needsTap = false;
  if (state.mode === "episode") {
    state.mode = "live";
    state.episode = null;
    state.duration = songDuration;
  }
  emit();
}

export function toggle() {
  disarmFirstGesture();
  if (state.mode === "episode") {
    // Keep the position of a recorded show when pausing.
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
    return;
  }
  if (state.playing || state.loading) stop();
  else void playLive();
}

export function seek(fraction: number) {
  if (state.mode !== "episode") return;
  const total = audio.duration || state.duration;
  if (total) audio.currentTime = Math.max(0, Math.min(1, fraction)) * total;
}

export function setVolume(v: number) {
  state.volume = v;
  audio.volume = v / 100;
  store.set("ea-volume", String(v));
  emit();
}

export function setSaver(on: boolean) {
  state.saver = on;
  store.set("ea-saver", on ? "1" : "0");
  emit();
  if (state.mode === "live" && (state.playing || state.loading)) void playLive();
}

audio.addEventListener("playing", () => {
  state.loading = false;
  state.playing = true;
  state.needsTap = false;
  emit();
});
audio.addEventListener("pause", () => {
  if (state.mode === "episode" && audio.getAttribute("src")) {
    state.playing = false;
    emit();
  }
});
audio.addEventListener("ended", () => {
  if (state.mode === "episode") stop();
});
audio.addEventListener("error", () => {
  if (!audio.getAttribute("src")) return;
  const wasEpisode = state.mode === "episode";
  stop();
  state.error = wasEpisode
    ? "No se pudo cargar el programa. Intenta de nuevo."
    : "Se cortó la transmisión. Presiona reproducir para reconectar.";
  emit();
});

// Browsers block sound until the visitor interacts, so when autoplay is refused we
// start on the first tap/key on an empty area of the page.
function onFirstGesture(e: Event) {
  disarmFirstGesture();
  const target = e.target as Element | null;
  if (target?.closest("a, button, input, label, select, [role=slider]")) return;
  if (e.type === "keydown") {
    const key = (e as KeyboardEvent).key;
    if (key === "Tab" || key === "Shift" || key === "Escape") return;
  }
  if (!userStopped && !state.playing && !state.loading) void playLive();
}
function armFirstGesture() {
  document.addEventListener("pointerdown", onFirstGesture, { once: true });
  document.addEventListener("keydown", onFirstGesture, { once: true });
}
function disarmFirstGesture() {
  document.removeEventListener("pointerdown", onFirstGesture);
  document.removeEventListener("keydown", onFirstGesture);
}

// ---------- lock screen controls ----------
function setMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const ep = state.mode === "episode" ? state.episode : null;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: ep ? ep.title : state.title,
    artist: ep ? "Estampas Andinas" : state.artist || "Estampas Andinas",
    album: ep ? "Programas anteriores" : "Estampas Andinas",
    artwork: state.art && !ep ? [{ src: state.art, sizes: "512x512" }] : [],
  });
  navigator.mediaSession.setActionHandler("play", () => (state.playing ? undefined : toggleOrLive()));
  navigator.mediaSession.setActionHandler("pause", () => (state.playing ? toggle() : undefined));
}
function toggleOrLive() {
  if (state.mode === "episode") toggle();
  else void playLive();
}

// ---------- now playing (polled) ----------
async function refresh() {
  try {
    const res = await fetch(NOW_PLAYING_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    state.online = Boolean(data.is_online);
    state.isLive = Boolean(data.live?.is_live);
    state.streamer = String(data.live?.streamer_name ?? "");

    const mounts = (data.station?.mounts ?? []) as Mount[];
    const def = mounts.find((m) => m.is_default) ?? mounts[0];
    if (def) defaultStream = def.url;
    state.lowMount =
      (def &&
        mounts
          .filter((m) => m !== def && m.bitrate && m.bitrate < def.bitrate)
          .sort((a, b) => a.bitrate - b.bitrate)[0]) ||
      null;
    state.saver = wantsSaver();

    const np = data.now_playing ?? {};
    const song: Song = np.song ?? {};
    songDuration = Number(np.duration) || 0;
    baseElapsed = Number(np.elapsed) || 0;
    fetchedAt = Date.now();
    if (state.mode === "live") state.duration = songDuration;

    if (np.sh_id !== currentId) {
      currentId = np.sh_id;
      state.title = song.title || song.text || "Estampas Andinas";
      state.artist = song.artist || "";
      state.art = await resolveArt(song.art);
      setMediaSession();
    }
    state.listeners = Number(data.listeners?.current) || 0;
    state.history = ((data.song_history as HistoryItem[] | undefined) ?? []).slice(0, 30);
  } catch {
    // Keep the last known state; the next poll retries.
  }
  emit();
}

function tick() {
  state.elapsed =
    state.mode === "episode"
      ? audio.currentTime || 0
      : Math.min(songDuration || Infinity, baseElapsed + (Date.now() - fetchedAt) / 1000);
  if (state.mode === "episode" && audio.duration && isFinite(audio.duration)) {
    state.duration = audio.duration;
  }
  emit();
}

// ---------- recorded shows ----------
async function loadEpisodes() {
  try {
    const res = await fetch(PODCASTS_URL);
    if (!res.ok) return;
    const podcasts = ((await res.json()) as Podcast[]).filter((p) => p.is_published !== false);
    const lists = await Promise.all(
      podcasts.map((p) =>
        fetch(p.links.episodes)
          .then((r) => (r.ok ? (r.json() as Promise<Episode[]>) : []))
          .catch(() => [] as Episode[]),
      ),
    );
    state.episodes = ([] as Episode[])
      .concat(...lists)
      .filter((e) => e.is_published !== false && e.has_media !== false)
      .sort((a, b) => b.publish_at - a.publish_at);
  } catch {
    /* keep the section hidden */
  }
  state.episodesLoaded = true;
  emit();
}

// ---------- start ----------
let started = false;
export function init() {
  if (started) return;
  started = true;
  const first = refresh();
  void loadEpisodes();
  const begin = () => {
    void first.then(() => {
      if (verySlowNet()) {
        state.needsTap = true; // Data Saver / 2G: never start by itself
        emit();
      } else {
        void playLive(true);
      }
    });
  };
  // Let the page and the photo finish loading before the stream competes for bandwidth.
  if (document.readyState === "complete") begin();
  else window.addEventListener("load", begin);
  setInterval(() => {
    if (document.hidden && !state.playing) return;
    void refresh();
  }, 15_000);
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
}
