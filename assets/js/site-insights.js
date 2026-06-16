const POSTS_DATA_URL = resolveAssetUrl("assets/data/posts.json");
const ACTIVITY_DATA_URL = resolveAssetUrl("assets/data/activity.json");

initInsights();

async function initInsights() {
  const [postsData, activityData] = await Promise.all([
    loadJson(POSTS_DATA_URL),
    loadJson(ACTIVITY_DATA_URL)
  ]);

  if (postsData?.posts) {
    renderPostListStats(postsData.posts);
    renderCurrentArticleStats(postsData.posts);
  }

  if (activityData?.days) {
    renderActivityGrid(activityData.days);
  }
}

async function loadJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function resolveAssetUrl(path) {
  const depth = location.pathname.includes("/posts/") || location.pathname.includes("/categories/") ? "../" : "";
  return `${depth}${path}`;
}

function renderPostListStats(posts) {
  document.querySelectorAll("[data-post-url]").forEach((item) => {
    const url = item.getAttribute("data-post-url");
    const post = posts.find((entry) => entry.url === url);
    if (!post) return;
    const stats = item.querySelector("[data-post-stats]");
    if (stats) stats.innerHTML = postStatsMarkup(post);
  });
}

function renderCurrentArticleStats(posts) {
  const target = document.querySelector("[data-current-post-stats]");
  if (!target) return;
  const normalizedPath = location.pathname.replace(/^\//, "");
  const post = posts.find((entry) => normalizedPath.endsWith(entry.url));
  if (post) target.innerHTML = postStatsMarkup(post);
}

function postStatsMarkup(post) {
  return `
    <span>${formatWords(post.words)}</span>
    <span>约 ${post.readingMinutes} 分钟</span>
  `;
}

function formatWords(words) {
  if (words >= 1000) return `${(words / 1000).toFixed(1)}k 字`;
  return `${words} 字`;
}

function renderActivityGrid(days) {
  const grid = document.querySelector("[data-activity-grid]");
  const summary = document.querySelector("[data-activity-summary]");
  if (!grid) return;

  const counts = new Map(days.map((day) => [day.date, Number(day.count) || 0]));
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 364);

  const cells = [];
  let activeDays = 0;
  let total = 0;

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = toDateKey(cursor);
    const count = counts.get(date) || 0;
    if (count > 0) activeDays += 1;
    total += count;
    const level = count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 7 ? 3 : 4;
    cells.push(`<span class="activity-cell level-${level}" title="${date}: ${count} 次提交" aria-label="${date}: ${count} 次提交"></span>`);
  }

  grid.innerHTML = cells.join("");
  if (summary) {
    summary.textContent = `过去一年 ${activeDays} 天有提交，共 ${total} 次提交`;
  }
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
