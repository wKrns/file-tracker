import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import os from "os";
import chokidar from "chokidar";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Utils tah augustus prime pas 2 crack ici fils ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nowIso() {
  return new Date().toISOString();
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sizePretty(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

async function sha256OfFile(filePath, maxBytes = Infinity) {
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return null;
    if (stat.size > maxBytes) return null;

    const hash = crypto.createHash("sha256");
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    return hash.digest("hex");
  } catch {
    return null;
  }
}

function isSuspiciousCreate(p, cfg) {
  const ext = path.extname(p).toLowerCase();
  const susExt = [".exe", ".dll", ".bat", ".ps1", ".lnk"];
  const inStartup = p.toLowerCase().startsWith(cfg.paths.STARTUP.toLowerCase());
  const inDownloads = p.toLowerCase().startsWith(cfg.paths.DOWNLOADS.toLowerCase());
  return (susExt.includes(ext) && (inStartup || inDownloads)) || inStartup;
}

function rel(p, baseList) {
  for (const base of baseList) {
    const rp = path.relative(base, p);
    if (!rp.startsWith("..")) return path.join(path.basename(base), rp);
  }
  return p;
}

// ---------- Config tah KRNSV2 sur RINA mon NIGGER ----------
const DEFAULT_PATHS = (() => {
  const USERPROFILE = process.env.USERPROFILE || os.homedir();
  const DOWNLOADS = path.join(USERPROFILE, "Downloads");
  const DESKTOP = path.join(USERPROFILE, "Desktop");
  const DOCUMENTS = path.join(USERPROFILE, "Documents");
  const STARTUP = path.join(
    process.env.APPDATA || path.join(USERPROFILE, "AppData", "Roaming"),
    "Microsoft/Windows/Start Menu/Programs/Startup"
  );
  return { USERPROFILE, DOWNLOADS, DESKTOP, DOCUMENTS, STARTUP };
})();

const defaultConfig = {
  watch: [
    DEFAULT_PATHS.DOWNLOADS,
    DEFAULT_PATHS.DESKTOP,
    DEFAULT_PATHS.DOCUMENTS,
    DEFAULT_PATHS.STARTUP
  ],
  ignored: [
    "**/node_modules/**",
    "**/.git/**",
    "**/*.tmp",
    "**/*.temp",
    "**/~$*"
  ],
  hashMaxBytes: 10 * 1024 * 1024, // 10 MB prsk sinon mon script crash mon nigga
  logDir: path.join(__dirname, "logs"),
  discordWebhook: process.env.DISCORD_WEBHOOK || "", // mettre ton webhook dans .env fils de pute
  webhookMinIntervalMs: 4000, // anti-spam prsk ton pc pas ouf va crash
  verbose: true
};

let config = { ...defaultConfig, paths: DEFAULT_PATHS };

const configPath = path.join(__dirname, "config.json");
if (fs.existsSync(configPath)) {
  try {
    const userCfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config = { ...config, ...userCfg };
  } catch (e) {
    console.warn("[!] config.json invalide gros negres , utilisation de la config par défaut.", e.message);
  }
}

// Crée /logs
ensureDirSync(config.logDir);

// ---------- Logging NDJSON meme si c inutile tocard  ----------
function logLine(obj) {
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(config.logDir, `filetracker-${day}.ndjson`);
  fs.appendFile(file, JSON.stringify(obj) + "\n", (err) => {
    if (err) console.error("[log error]", err.message);
  });
  if (config.verbose) {
    const { ts, event, path: p, size, hash } = obj;
    const extra = [];
    if (size != null) extra.push(`size=${sizePretty(size)}`);
    if (hash) extra.push(`sha256=${hash.slice(0, 10)}…`);
    console.log(`[${ts}] ${event.toUpperCase()} ${p}${extra.length ? " (" + extra.join(", ") + ")" : ""}`);
  }
}

// ---------- Discord webhook (si tu veut connard) ----------
let lastWebhookTs = 0;
async function sendWebhook(payload) {
  if (!config.discordWebhook) return;

  const since = Date.now() - lastWebhookTs;
  if (since < config.webhookMinIntervalMs) {
    await sleep(config.webhookMinIntervalMs - since);
  }
  lastWebhookTs = Date.now();

  try {
    const res = await fetch(config.discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn("[webhook warn]", res.status, await res.text());
    }
  } catch (e) {
    console.warn("[webhook error]", e.message);
  }
}

function alertEmbed({ title, description, color = 16742886, fields = [] }) {
  return {
    username: "File Tracker",
    embeds: [
      {
        title,
        description,
        color,
        timestamp: new Date().toISOString(),
        fields
      }
    ]
  };
}

// ---------- Watcher ta meuf sous la douche ----------
function startWatcher() {
  const watchList = config.watch.filter((p) => fs.existsSync(p));
  if (watchList.length === 0) {
    console.error("Aucun dossier à surveiller nigga. Vérifie 'watch' ou NTGRM dans config.json.");
    process.exit(1);
  }

  console.log("Watching:", watchList.join(" | "));
  const watcher = chokidar.watch(watchList, {
    ignored: config.ignored,
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
  });

  const baseList = watchList;

  watcher
    .on("add", async (p, stats) => {
      const stat = stats || await safeStat(p);
      const item = {
        ts: nowIso(),
        event: "add",
        path: rel(p, baseList),
        absPath: p,
        size: stat?.size ?? null
      };
      if (stat?.size != null && stat.size <= config.hashMaxBytes) {
        item.hash = await sha256OfFile(p, config.hashMaxBytes);
      }
      logLine(item);

      if (isSuspiciousCreate(p, { paths: config.paths })) {
        await sendWebhook(
          alertEmbed({
            title: "🟥 Suspicious file",
            description: "Un fichier sus créé.",
            fields: [
              { name: "Path", value: "```" + p + "```" },
              ...(item.size != null ? [{ name: "Size", value: sizePretty(item.size), inline: true }] : []),
              ...(item.hash ? [{ name: "SHA-256", value: "`" + item.hash + "`" }] : [])
            ]
          })
        );
      }
    })
    .on("change", async (p, stats) => {
      const stat = stats || await safeStat(p);
      const item = {
        ts: nowIso(),
        event: "change",
        path: rel(p, baseList),
        absPath: p,
        size: stat?.size ?? null
      };
      if (stat?.size != null && stat.size <= config.hashMaxBytes) {
        item.hash = await sha256OfFile(p, config.hashMaxBytes);
      }
      logLine(item);
    })
    .on("unlink", (p) => {
      logLine({ ts: nowIso(), event: "unlink", path: rel(p, baseList), absPath: p });
    })
    .on("addDir", (p) => {
      logLine({ ts: nowIso(), event: "addDir", path: rel(p, baseList), absPath: p });
    })
    .on("unlinkDir", (p) => {
      logLine({ ts: nowIso(), event: "unlinkDir", path: rel(p, baseList), absPath: p });
    })
    .on("error", (err) => {
      logLine({ ts: nowIso(), event: "error", error: String(err) });
      console.error("[watch error]", err);
    })
    .on("ready", () => {
      console.log("✅ Ready. Tracking changes...");
    });

  // Burst deletion detector (simple prsk sinon t trop con)
  let deletionBuffer = [];
  setInterval(async () => {
    if (deletionBuffer.length >= 10) {
      const sample = deletionBuffer.slice(0, 5).map((p) => "- " + p).join("\n");
      await sendWebhook(
        alertEmbed({
          title: "🟧 Many deletions detected beacause of nigger",
          description: `Supprimés: **${deletionBuffer.length}** fichiers ces 30s.\n\`\`\`\n${sample}\n...\n\`\`\``,
          color: 16753920
        })
      );
    }
    deletionBuffer = [];
  }, 30_000);

  watcher.on("unlink", (p) => {
    deletionBuffer.push(rel(p, baseList));
  });
}

async function safeStat(p) {
  try { return await fsp.stat(p); } catch { return null; }
}

startWatcher();

// Graceful shutdown because ur a stoopid nigger
process.on("SIGINT", () => {
  console.log("\nBye.");
  process.exit(0);
});

