import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");
const postsDir = path.join(rootDir, "posts");
const dataDir = path.join(rootDir, "assets", "data");
const wordsPerMinute = 450;

const posts = await collectPosts();
const activity = collectActivity();

await writeJson(path.join(dataDir, "posts.json"), { generatedAt: todayKey(), posts });
await writeJson(path.join(dataDir, "activity.json"), { generatedAt: todayKey(), days: activity });

console.log(`Generated ${posts.length} post records and ${activity.length} active days.`);

async function collectPosts() {
  const files = (await readdir(postsDir)).filter((file) => file.endsWith(".html")).sort();
  const records = [];

  for (const file of files) {
    const absolutePath = path.join(postsDir, file);
    const html = await readFile(absolutePath, "utf8");
    const article = extractTag(html, "main") || html;
    const text = htmlDecode(stripTags(article)).replace(/\s+/g, " ").trim();
    const words = countReadableUnits(text);
    records.push({
      title: extractTag(html, "title").replace(/\s*\|\s*Young Zhang\s*$/, "").trim(),
      url: `posts/${file}`,
      date: extractDate(html),
      category: extractCategory(html),
      words,
      readingMinutes: Math.max(1, Math.ceil(words / wordsPerMinute))
    });
  }

  return records.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "zh-CN"));
}

function collectActivity() {
  let output = "";
  try {
    output = execFileSync("git", ["log", "--date=short", "--pretty=format:%ad"], {
      cwd: rootDir,
      encoding: "utf8"
    });
  } catch {
    return [];
  }

  const counts = new Map();
  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((date) => counts.set(date, (counts.get(date) || 0) + 1));

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function extractTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripTags(match[1]).trim() : "";
}

function extractDate(html) {
  const match = html.match(/<time[^>]+datetime="([^"]+)"/i) || html.match(/抽象代数\s*·\s*(\d{4}\.\d{2}\.\d{2})/);
  if (!match) return todayKey();
  return match[1].replaceAll(".", "-");
}

function extractCategory(html) {
  const eyebrow = html.match(/<p class="eyebrow">([^<]+)<\/p>/i)?.[1] || "";
  if (eyebrow.includes("·")) return eyebrow.split("·")[0].trim();
  return "站点";
}

function stripTags(value) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function htmlDecode(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function countReadableUnits(text) {
  const cjk = text.match(/\p{Script=Han}/gu)?.length || 0;
  const latin = text.match(/[A-Za-z0-9]+/g)?.length || 0;
  return cjk + latin;
}

async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
