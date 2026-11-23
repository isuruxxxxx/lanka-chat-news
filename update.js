// Lanka Chat data feed — runs on GitHub Actions, no keys, no browser.
// Fetches Google News RSS (EN + SI, 6 categories) and checks which of the
// 7 Sri Lankan TV channels is live on YouTube right now, then writes
// news.json + live.json at the repo root. The Lanka Chat page fetches those
// files directly from raw.githubusercontent.com (CORS allowed).
const fs = require("fs");

const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" };

const CATS = [
  { label: "Top", q: "Sri Lanka" },
  { label: "World", q: "world news Sri Lanka" },
  { label: "Sports", q: "Sri Lanka sports" },
  { label: "Technology", q: "Sri Lanka technology" },
  { label: "Business", q: "Sri Lanka business" },
  { label: "Entertainment", q: "Sri Lanka entertainment" }
];

const CHANNELS = [
  { name: "Hiru TV", id: "UCOtYyt7W5PmPnwQjWWF_Z-Q" },
  { name: "TV Derana", id: "UCc9qiiRqqKKo9rgyj3bysAg" },
  { name: "Sirasa TV", id: "UCu3vWkFUnfddXnd0tsmmkkQ" },
  { name: "ITN Sri Lanka", id: "UCQTcNhAZidy1i9wwmdgf2Lw" },
  { name: "Rupavahini", id: "UCT83ymyAGm7Gnk_4ifxjxIA" },
  { name: "Swarnavahini", id: "UCaIc6SgS90ud_RgMSC6hW_w" },
  { name: "Ada Derana", id: "UCK-ZW31svFPfqrS-KetoNWg" }
];

function newsFeedUrl(q, lang) {
  const hl = lang === "si" ? "si" : "en-LK";
  const ceid = lang === "si" ? "LK:si" : "LK:en";
  return "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=" + hl + "&gl=LK&ceid=" + ceid;
}

function parseNewsXml(text) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(text)) && items.length < 10) {
    const b = m[1];
    const pick = (tag) => { const x = b.match(new RegExp("<" + tag + "(?: [^>]*)?>([\\s\\S]*?)</" + tag + ">")); return x ? x[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : ""; };
    const title = pick("title");
    const link = pick("link");
    const pub = pick("pubDate");
    const src = (b.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "";
    if (!title || !link) continue;
    items.push({ title, link, source: src.trim(), pubDate: pub, ts: pub ? Date.parse(pub) : 0 });
  }
  return items;
}

function liveVideoId(html) {
  const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  const i = html.search(/"isLive":true|"isLiveNow":true/);
  if (i >= 0) {
    const seg = html.slice(Math.max(0, i - 600), i + 200);
    const v = seg.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    if (v) return v[1];
  }
  return null;
}

async function fetchText(url, timeoutMs) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: UA, signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(to); }
}

(async () => {
  const news = { updatedAt: new Date().toISOString(), feeds: {} };
  for (const lang of ["en", "si"]) {
    for (let ci = 0; ci < CATS.length; ci++) {
      const key = lang + ":" + ci;
      try {
        const text = await fetchText(newsFeedUrl(CATS[ci].q, lang), 20000);
        news.feeds[key] = parseNewsXml(text);
        console.log("news", key, news.feeds[key].length, "items");
      } catch (e) {
        console.log("news", key, "FAILED:", e.message);
        news.feeds[key] = [];
      }
    }
  }
  fs.writeFileSync("news.json", JSON.stringify(news, null, 2) + "\n");

  const live = { updatedAt: new Date().toISOString(), channels: {} };
  for (const ch of CHANNELS) {
    try {
      const html = await fetchText("https://www.youtube.com/channel/" + ch.id + "/live", 20000);
      live.channels[ch.id] = liveVideoId(html);
      console.log("live", ch.name, live.channels[ch.id] || "not live");
    } catch (e) {
      console.log("live", ch.name, "FAILED:", e.message);
      live.channels[ch.id] = null;
    }
  }
  fs.writeFileSync("live.json", JSON.stringify(live, null, 2) + "\n");
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
