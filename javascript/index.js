const container = document.getElementById('container');
const searchBar = document.getElementById('searchBar');
const sortOptions = document.getElementById('sortOptions');
// https://www.jsdelivr.com/tools/purge
const coverURL = "https://cdn.jsdelivr.net/gh/freebuisness/covers@main";
const htmlURL = "https://cdn.jsdelivr.net/gh/freebuisness/html@main";
const OFFICIAL_URL = "https://daily-light-bible.fisherrivar32.chatgpt.site/";
const RECENT_KEY = "fz_recent";
const FAVS_KEY = "fz_favs";
const THEME_KEY = "fz_dark";
const LAST_KEY = "fz_last_zone";
const REQUEST_WEBHOOK = "https://discord.com/api/webhooks/1536403279687192698/i3RoGHwk1I_9_BgzWAA3PIJ5lYgfpKWa2ZwiWCDQ1q8luzYnLMwIwgFXXsqZaGkv3-1r";
let zones = [];
let popularityData = {};
const featuredContainer = document.getElementById('featuredZones');
const mustCheckContainer = document.getElementById('mustCheckZones');
const openSourceProgramsContainer = document.getElementById('openSourcePrograms');
const recentContainer = document.getElementById('recentZones');
const favContainer = document.getElementById('favZones');
let zoneHistory = [];
let currentZone = null;
let currentFrameUrl = null;
const rawFavs = loadFromStorage(FAVS_KEY, []);
let favs = new Set(Array.isArray(rawFavs) ? rawFavs : []);
let zonesLoaded = false;
let viewerLoadToken = 0;
let lastFilterQuery = "";
let filterTimer = null;
let activeTag = "";
let playsData = {};

function loadFromStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
}

function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
    }
}

async function listZones() {
    try {
        const data = window.fzGate && window.fzGate.data();
        if (!data || !Array.isArray(data.zones)) {
            container.innerHTML = "Locked — no data loaded.";
            return;
        }
        zones = data.zones;
        zonesLoaded = true;
        loadPlaysData();
        renderTagBar();
        updateContinueButton();
        sortZones();
        renderRecent();
        renderFavorites();
        renderOpenSourcePrograms();
        updateZoneCount();
        if (searchBar.value.trim()) filterZones();
        if (window.resourceSaver && window.resourceSaver.isOn()) {
            popularityData[0] = 0;
        } else {
            fetchPopularity().then(() => {
                if (sortOptions.value === 'popular') sortZones();
            });
        }
        const search = new URLSearchParams(window.location.search);
        const id = search.get('id');
        if (id) {
            const zone = zones.find(zone => zone.id + '' == id + '');
            if (zone) {
                if (zone.fallbackUrl) {
                    openViewer(zone.name);
                    zoneHistory.push(zone);
                    currentZone = zone;
                    loadZoneIntoFrame({ ...zone, url: zone.fallbackUrl }, zone);
                } else if (isExternalZone(zone) && !zone.embed) {
                    toast(`${zone.name} is an external site — your browser may block auto-open. Open it directly from the list.`);
                    window.open(getZoneURL(zone), "_blank", "noopener");
                } else {
                    openZone(zone);
                }
            } else {
                toast("Zone not found for that link");
            }
        }
    } catch (error) {
        console.error(error);
        if (!container.innerHTML || container.innerHTML === "Loading...") {
            container.innerHTML = "Couldn't load the zone list. Check your connection and refresh.";
        }
    }
}
async function fetchPopularity() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch("https://data.jsdelivr.com/v1/stats/packages/gh/freebuisness/html@main/files?period=year", { signal: controller.signal });
        clearTimeout(timer);
        const data = await response.json();
        data.forEach(file => {
            const idMatch = file.name.match(/\/(\d+)\.html$/);
            if (idMatch) {
                const id = parseInt(idMatch[1]);
                popularityData[id] = file.hits.total;
            }
        });
    } catch (error) {
        clearTimeout(timer);
        popularityData[0] = 0;
    }
}

function updateZoneCount() {
    const el = document.getElementById('zoneCount');
    if (el) el.textContent = zones.length;
}

function loadPlaysData() {
    playsData = {};
    let recent = loadFromStorage(RECENT_KEY, []);
    if (!Array.isArray(recent)) recent = [];
    recent.forEach(e => {
        if (e && e.file && e.file.id != null) {
            playsData[e.file.id] = Number(e.plays) || 1;
        }
    });
}

function sortZones() {
    const sortBy = sortOptions.value;
    const compare = {
        name: (a, b) => (a.name || "").localeCompare(b.name || ""),
        id: (a, b) => a.id - b.id,
        popular: (a, b) => (popularityData[b.id] || 0) - (popularityData[a.id] || 0),
        plays: (a, b) => (playsData[b.id] || 0) - (playsData[a.id] || 0)
    }[sortBy] || (() => 0);
    zones.sort((a, b) => {
        const pinnedA = a && a.id === -1 ? -1 : 0;
        const pinnedB = b && b.id === -1 ? -1 : 0;
        return pinnedA - pinnedB || compare(a, b) || a.id - b.id;
    });
    const featured = zones.filter(z => z && z.featured);
    if (featured.length) displayFeaturedZones(featured);
    const mustCheck = zones.filter(z => z && z.mustCheck);
    if (mustCheck.length) displayMustCheckZones(mustCheck);
    if (searchBar.value.trim() || activeTag) {
        lastFilterQuery = "";
        applyFilterImmediate();
    } else {
        displayZones(zones);
    }
}

function renderTagBar() {
    const bar = document.getElementById('tagBar');
    if (!bar) return;
    const tagCounts = {};
    zones.forEach(z => {
        if (z && Array.isArray(z.tags)) {
            z.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
        }
    });
    const tags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
    if (tags.length === 0) {
        bar.style.display = 'none';
        bar.innerHTML = '';
        return;
    }
    bar.style.display = 'flex';
    const clear = document.createElement('button');
    clear.className = 'tag-chip clear' + (activeTag === "" ? ' active' : '');
    clear.textContent = 'All';
    clear.onclick = () => {
        activeTag = "";
        clear.classList.add('active');
        bar.querySelectorAll('.tag-chip:not(.clear)').forEach(c => c.classList.remove('active'));
        applyFilterImmediate();
    };
    bar.appendChild(clear);
    tags.forEach(tag => {
        const chip = document.createElement('button');
        chip.className = 'tag-chip' + (activeTag === tag ? ' active' : '');
        chip.textContent = tag + ' (' + tagCounts[tag] + ')';
        chip.onclick = () => {
            activeTag = activeTag === tag ? "" : tag;
            bar.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
            if (activeTag === "") {
                clear.classList.add('active');
            } else {
                chip.classList.add('active');
            }
            applyFilterImmediate();
        };
        bar.appendChild(chip);
    });
}

function applyFilterImmediate() {
    if (!zonesLoaded) return;
    const query = (searchBar.value || "").trim().toLowerCase();
    lastFilterQuery = query;
    let filtered = zones;
    if (activeTag) {
        filtered = filtered.filter(z => z && Array.isArray(z.tags) && z.tags.includes(activeTag));
    }
    if (query) {
        filtered = filtered.filter(z => z && z.name && z.name.toLowerCase().includes(query));
    }
    const searching = query.length !== 0 || activeTag !== "";
    ["featuredZonesWrapper", "mustCheckZonesWrapper", "openSourceProgramsWrapper", "recentZonesWrapper", "favZonesWrapper"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (searching) {
            el.removeAttribute("open");
        } else {
            el.setAttribute("open", "");
        }
    });
    displayZones(filtered);
}

function createZoneItem(file) {
    const url = getZoneURL(file);
    const isFav = favs.has(file.id);
    const zoneItem = document.createElement("a");
    zoneItem.className = "zone-item";
    zoneItem.href = url;
    zoneItem.rel = "noopener";

    zoneItem.onclick = (event) => {
        event.preventDefault();
        openZone(file);
    };

    const img = document.createElement("img");
    let coverSrc = (file.cover || "WebLogo/Kmoon.webp").replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
    if (window.resourceSaver && window.resourceSaver.isOn() && !coverSrc.startsWith("special/") && !coverSrc.startsWith("WebLogo/") && !coverSrc.startsWith("data:")) {
        coverSrc = "WebLogo/Kmoon.webp";
    }
    img.dataset.src = coverSrc;
    img.alt = file.name || "";
    img.loading = "lazy";
    img.className = "lazy-zone-img";
    let coverTried = false;
    const fallbackCover = "WebLogo/Kmoon.webp";
    img.onerror = () => {
        if (!coverTried && file.fallbackCover) {
            coverTried = true;
            img.src = file.fallbackCover;
            return;
        }
        if (img.src.split("?")[0].split("#")[0] === new URL(fallbackCover, location.href).href) return;
        img.src = fallbackCover;
    };
    zoneItem.appendChild(img);

    if (file.mustCheck) {
        const badge = document.createElement("span");
        badge.className = "zone-badge";
        badge.textContent = "NEW";
        zoneItem.appendChild(badge);
    }

    const favButton = document.createElement("button");
    favButton.className = "fav-toggle" + (isFav ? " faved" : "");
    favButton.type = "button";
    favButton.dataset.fav = file.id;
    favButton.title = isFav ? "Remove from favorites" : "Add to favorites";
    favButton.textContent = "★";
    favButton.onclick = (event) => {
        event.stopPropagation();
        toggleFav(file);
    };
    zoneItem.appendChild(favButton);

    const infoButton = document.createElement("button");
    infoButton.className = "zone-info";
    infoButton.type = "button";
    infoButton.title = "Info";
    infoButton.textContent = "i";
    infoButton.onclick = (event) => {
        event.stopPropagation();
        showZoneInfo(file);
    };
    zoneItem.appendChild(infoButton);

    const button = document.createElement("button");
    button.textContent = (file.name || "Zone") + (file.external ? " ↗" : "");
    button.onclick = (event) => {
        event.stopPropagation();
        openZone(file);
    };
    zoneItem.appendChild(button);

    return zoneItem;
}

const observedImgs = new Set();
const lazyObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) img.src = img.dataset.src;
            img.classList.remove("lazy-zone-img");
            observer.unobserve(img);
            observedImgs.delete(img);
        }
    });
}, {
    rootMargin: "100px",
    threshold: 0.1
});

function attachLazyLoad(containerSelector) {
    observedImgs.forEach(img => {
        if (!document.contains(img)) {
            lazyObserver.unobserve(img);
            observedImgs.delete(img);
        }
    });
    document.querySelectorAll(containerSelector + ' img.lazy-zone-img').forEach(img => {
        if (!observedImgs.has(img)) {
            observedImgs.add(img);
            lazyObserver.observe(img);
        }
    });
}

function displayFeaturedZones(featuredZones) {
    featuredContainer.innerHTML = "";
    featuredZones.forEach(file => {
        featuredContainer.appendChild(createZoneItem(file));
    });
    if (featuredContainer.innerHTML === "") {
        featuredContainer.innerHTML = "No featured zones found.";
    } else {
        const summary = document.getElementById("allZonesSummary");
        if (summary) summary.textContent = `Featured Zones (${featuredZones.length})`;
    }
    attachLazyLoad('#featuredZones');
}

function displayMustCheckZones(mustCheckZones) {
    mustCheckContainer.innerHTML = "";
    mustCheckZones.forEach(file => {
        mustCheckContainer.appendChild(createZoneItem(file));
    });
    if (mustCheckContainer.innerHTML === "") {
        mustCheckContainer.innerHTML = "No zones found.";
    } else {
        const summary = document.getElementById("mustCheckZonesSummary");
        if (summary) summary.textContent = `Must Check Out (${mustCheckZones.length})`;
    }

    attachLazyLoad('#mustCheckZones');
}

function renderOpenSourcePrograms() {
    if (!openSourceProgramsContainer) return;
    const programs = zones.filter(zone => zone.category === 'program');
    openSourceProgramsContainer.innerHTML = "";
    programs.forEach(program => openSourceProgramsContainer.appendChild(createZoneItem(program)));
    const summary = document.getElementById("openSourceProgramsSummary");
    if (summary) summary.textContent =
        `Open-Source Programs (${programs.length})`;
    attachLazyLoad('#openSourcePrograms');
}

function displayZones(zones) {
    container.innerHTML = "";
    zones.forEach(file => {
        container.appendChild(createZoneItem(file));
    });

    if (container.innerHTML === "") {
        container.innerHTML = "No zones found.";
    } else {
        const summary = document.getElementById("allSummary");
        if (summary) summary.textContent = `All Zones (${zones.length})`;
    }
    attachLazyLoad('#container');
}

function renderRecent() {
    let recent = loadFromStorage(RECENT_KEY, []);
    if (!Array.isArray(recent)) recent = [];
    recent = recent.filter(e => e && typeof e.file === 'object' && e.file);
    recent = recent.map(e => ({ file: e.file, plays: Number(e.plays) || 1 }));
    const merged = [];
    recent.forEach(e => {
        const key = e.file.url || (e.file.id + '');
        const found = merged.find(m => (m.file.url || (m.file.id + '')) === key);
        if (found) {
            found.plays += e.plays;
        } else {
            merged.push({ file: e.file, plays: e.plays });
        }
    });
    recentContainer.innerHTML = "";
    merged.forEach(e => {
        const item = createZoneItem(e.file);
        if (e.plays > 1) {
            const badge = document.createElement("span");
            badge.className = "play-count";
            badge.textContent = "×" + e.plays;
            badge.title = "Played " + e.plays + " times";
            item.appendChild(badge);
        }
        recentContainer.appendChild(item);
    });
    if (recentContainer.innerHTML === "") {
        recentContainer.innerHTML = "Play some zones and they'll show up here.";
    } else {
        const summary = document.getElementById("recentZonesSummary");
        if (summary) summary.textContent = `Recently Played (${merged.length})`;
    }
    attachLazyLoad('#recentZones');
}

function renderFavorites() {
    const favZones = zones.filter(z => favs.has(z.id));
    favContainer.innerHTML = "";
    favZones.forEach(file => {
        favContainer.appendChild(createZoneItem(file));
    });
    if (favContainer.innerHTML === "") {
        favContainer.innerHTML = "Tap the star on a zone to save it here.";
    } else {
        const summary = document.getElementById("favZonesSummary");
        if (summary) summary.textContent = `Favorites (${favZones.length})`;
    }
    attachLazyLoad('#favZones');
}

function pushRecent(file) {
    if (!file || typeof file !== 'object') return;
    let recent = loadFromStorage(RECENT_KEY, []);
    if (!Array.isArray(recent)) recent = [];
    recent = recent.filter(e => e && typeof e.file === 'object' && e.file);
    recent = recent.map(e => ({ file: e.file, plays: Number(e.plays) || 1 }));
    const key = file.url || (file.id + '');
    const existing = recent.find(e => (e.file.url || (e.file.id + '')) === key);
    if (existing) {
        existing.plays = (existing.plays || 1) + 1;
        recent.splice(recent.indexOf(existing), 1);
        recent.unshift(existing);
    } else {
        recent.unshift({ file, plays: 1 });
    }
    recent = recent.slice(0, 8);
    saveToStorage(RECENT_KEY, recent);
    renderRecent();
}

function toggleFav(file) {
    if (favs.has(file.id)) {
        favs.delete(file.id);
        toast(`Removed "${file.name}" from favorites`);
    } else {
        favs.add(file.id);
        toast(`Added "${file.name}" to favorites`);
    }
    saveToStorage(FAVS_KEY, [...favs]);
    renderFavorites();
    document.querySelectorAll(`.fav-toggle[data-fav="${file.id}"]`).forEach(btn => {
        btn.classList.toggle("faved");
        btn.title = favs.has(file.id) ? "Remove from favorites" : "Add to favorites";
    });
}

async function openZone(file) {
    const url = getZoneURL(file);
    saveToStorage(LAST_KEY, { id: file.id, name: file.name, url: file.url });
    updateContinueButton();
    if (!file.url) {
        loadZoneHtml(file);
        return;
    }
    if (file.fallbackUrl) {
        await openSmartZone(file);
        return;
    }
    if (file.embed) {
        openViewer(file.name);
        zoneHistory.push(file);
        currentZone = file;
        loadZoneIntoFrame(file);
        return;
    }
    if (isExternalZone(file)) {
        window.open(url, "_blank", "noopener");
        return;
    }
    openViewer(file.name);
    zoneHistory.push(file);
    currentZone = file;
    loadZoneIntoFrame(file);
}

function isExternalZone(file) {
    const url = getZoneURL(file);
    if (file.embed) return false;
    if (file.external) return true;
    if (/^https:\/\/(www\.)?discord\.(gg|com)\//i.test(url)) return true;
    return /^https?:\/\//i.test(url) && !url.startsWith(htmlURL);
}

async function openSmartZone(file) {
    toast(`Checking ${file.name}...`);
    const online = await isReachable(file.url);
    if (online) {
        window.open(file.url, "_blank", "noopener");
        toast(`Opened the official ${file.name} site`);
    } else {
        toast(`No internet — using offline copy`);
        openViewer(file.name);
        zoneHistory.push(file);
        currentZone = file;
        loadZoneIntoFrame({ ...file, url: file.fallbackUrl }, file);
    }
}

async function isReachable(url, timeout = 5000) {
    if (navigator.onLine === false) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
        return res.type === 'opaque' || res.ok;
    } catch (error) {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

function loadZoneIntoFrame(file, recentFile, recordRecent = true) {
    const token = ++viewerLoadToken;
    const url = getZoneURL(file);
    const frame = document.getElementById('zoneFrame');
    frame.removeAttribute('srcdoc');
    if (url.startsWith(htmlURL)) {
        loadHTMLIntoViewer(url, token);
    } else {
        frame.onload = () => { if (token === viewerLoadToken) showLoading(false); };
        frame.src = url;
    }
    currentFrameUrl = url;
    if (recordRecent) pushRecent(recentFile || file);
    showLoading(true);
}

function openViewer(name) {
    document.getElementById('zoneName').textContent = name;
    document.getElementById('zoneViewer').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('zoneFrame').focus(), 50);
}

function closeViewer() {
    const viewer = document.getElementById('zoneViewer');
    if (!viewer.classList.contains('open')) return;
    viewerLoadToken++;
    const frame = document.getElementById('zoneFrame');
    frame.onload = null;
    frame.removeAttribute('srcdoc');
    frame.src = 'about:blank';
    viewer.classList.remove('open');
    document.body.style.overflow = '';
    zoneHistory = [];
    currentZone = null;
    currentFrameUrl = null;
    showLoading(false);
}

function goBack() {
    if (zoneHistory.length > 1) {
        zoneHistory.pop();
        const prev = zoneHistory[zoneHistory.length - 1];
        currentZone = prev;
        loadZoneIntoFrame(prev, null, false);
    } else {
        closeViewer();
    }
}

function toggleViewerFullscreen() {
    const frame = document.getElementById('zoneFrame');
    if (!document.fullscreenElement) {
        (frame.requestFullscreen || frame.webkitRequestFullscreen || frame.msRequestFullscreen).call(frame);
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function copyZoneLink() {
    if (!currentZone) return;
    const id = currentZone.id;
    const url = location.href.split('?')[0].split('#')[0] + '?id=' + id;
    const done = () => toast(`Link copied for "${currentZone.name}"`);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, () => fallbackCopy(url, done));
    } else {
        fallbackCopy(url, done);
    }
}

function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        done();
    } catch (error) {
    }
    document.body.removeChild(ta);
}

function openExternalTab() {
    if (currentZone) {
        window.open(currentFrameUrl || getZoneURL(currentZone), "_blank", "noopener");
    }
}

function openRandomZone() {
    const playable = zones.filter(z => z.url && !isExternalZone(z));
    if (playable.length === 0) return;
    const file = playable[Math.floor(Math.random() * playable.length)];
    openZone(file);
    toast(`🎲 ${file.name}`);
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const viewerPlaceholderDoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;height:100vh;display:grid;place-items:center}</style></head><body><p>Loading game...</p></body></html>';

function loadHTMLIntoViewer(url, token) {
    if (token === undefined) token = viewerLoadToken;
    const frame = document.getElementById('zoneFrame');
    frame.removeAttribute('src');
    frame.srcdoc = viewerPlaceholderDoc;
    fetch(url).then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
    }).then(html => {
        if (token !== viewerLoadToken) return;
        if (!/<base\b/i.test(html)) {
            const dir = url.replace(/\/[^/]*$/, '/');
            html = html.replace(/<\/head>/i, '<base href="' + escapeHtml(dir) + '">$&');
        }
        frame.srcdoc = html;
        showLoading(false);
    }).catch(error => {
        if (token !== viewerLoadToken) return;
        const dash = url.indexOf('.html-');
        if (dash !== -1) {
            loadHTMLIntoViewer(url.slice(0, dash + 5), token);
            return;
        }
        frame.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;height:100vh;display:grid;place-items:center}</style></head><body><p>Failed to load game: ' + escapeHtml(error) + '</p><p style="color:#888;font-size:12px">' + escapeHtml(url) + '</p></body></html>';
        showLoading(false);
    });
}

function loadZoneHtml(file) {
    const url = getZoneURL(file);
    fetch(url).then(response => response.text()).then(html => {
        document.documentElement.innerHTML = html;
        document.documentElement.querySelectorAll('script').forEach(oldScript => {
            const newScript = document.createElement('script');
            if (oldScript.src) {
                newScript.src = oldScript.src;
            } else {
                newScript.textContent = oldScript.textContent;
            }
            document.body.appendChild(newScript);
        });
        showGameControls();
    }).catch(error => alert("Failed to load zone: " + error));
}

function showGameControls() {
    if (document.getElementById('game-controls')) return;
    const panel = document.createElement('div');
    panel.id = 'game-controls';
    panel.style.cssText = 'position: fixed; bottom: 15px; left: 15px; z-index: 999999; display: flex; flex-direction: column; gap: 8px; font-family: Arial, sans-serif;';

    const escapeBtn = document.createElement('button');
    escapeBtn.textContent = 'Escape';
    escapeBtn.title = 'Go back to the main page';
    escapeBtn.style.cssText = 'background-color: #fc2651; color: #fff; border: none; border-radius: 6px; padding: 10px 16px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.35);';
    escapeBtn.addEventListener('click', () => location.reload());

    const killBtn = document.createElement('button');
    killBtn.textContent = 'Kill';
    killBtn.title = 'Close this tab';
    killBtn.style.cssText = 'background-color: #333; color: #fff; border: none; border-radius: 6px; padding: 10px 16px; font-size: 14px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.35);';
    killBtn.addEventListener('click', () => window.close());

    panel.appendChild(escapeBtn);
    panel.appendChild(killBtn);
    document.body.appendChild(panel);
}

function getZoneURL(file) {
    if (!file) return "";
    if (file.url) {
        return file.url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
    } else {
        return "games/" + (file.name || String(file.id || "zone"))
            .replace(/ /g, '-')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-');
    }
}

function filterZones() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(applyFilterImmediate, 150);
}

function showLoading(show) {
    const el = document.getElementById('viewerLoading');
    if (el) el.style.display = show ? 'flex' : 'none';
}

function toast(message) {
    let el = document.getElementById('fz-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'fz-toast';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function saveData() {
    let data = JSON.stringify(localStorage) + "\n\n|\n\n" + document.cookie;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([data], {
        type: "text/plain"
    }));
    link.download = `${Date.now()}.data`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function loadData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        const [localStorageData, cookieData] = content.split("\n\n|\n\n");
        try {
            const parsedData = JSON.parse(localStorageData);
            for (let key in parsedData) {
                try { localStorage.setItem(key, parsedData[key]); } catch (err) { }
            }
        } catch (error) {
        }
        if (cookieData) {
            const cookies = cookieData.split("; ");
            cookies.forEach(cookie => {
                document.cookie = cookie;
            });
        }
        alert("Data loaded — refreshing to apply it");
        location.reload();
    };
    reader.readAsText(file);
}

function darkMode() {
    document.body.classList.toggle("dark-mode");
    saveToStorage(THEME_KEY, document.body.classList.contains("dark-mode") ? "dark" : "light");
}

function applySavedTheme() {
    const saved = loadFromStorage(THEME_KEY, "dark");
    document.body.classList.toggle("dark-mode", saved === "dark");
}

function cloakIcon(url) {
    const link = document.querySelector("link[rel~='icon']");
    link.rel = "icon";
    if ((url+"").trim().length === 0) {
        link.href = "WebLogo/Kmoon.webp";
    } else {
        link.href = url;
    }
    document.head.appendChild(link);
}
function cloakName(string) {
    if ((string+"").trim().length === 0) {
        document.title = "TheFreedomZone";
        return;
    }
    document.title = string;
}

function cloakPreset(name, icon) {
    cloakName(name);
    cloakIcon(icon);
    document.getElementById('tab-cloak-title').value = name;
    document.getElementById('tab-cloak-icon').value = icon;
    toast("Cloaked as \"" + name + "\"");
}

function tabCloak() {
    closePopup();
    document.getElementById('popupTitle').textContent = "Tab Cloak";
    const popupBody = document.getElementById('popupBody');
    const presets = [
        { name: 'Google', icon: 'https://www.google.com/favicon.ico' },
        { name: 'Google Docs', icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon-2023a.ico' },
        { name: 'Google Classroom', icon: 'https://ssl.gstatic.com/classroom/favicon.png' },
        { name: 'Canvas', icon: 'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico' },
        { name: 'Khan Academy', icon: 'https://cdn.kastatic.org/images/favicon.ico' },
        { name: 'Wikipedia', icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico' },
        { name: 'Moodle', icon: 'https://moodle.org/favicon.ico' }
    ];
    popupBody.innerHTML = `
        <div class="zone-desc-tags" style="margin-bottom:10px">
            ${presets.map(p => '<span class="cloak-preset" onclick="cloakPreset(' + JSON.stringify(p.name) + ',' + JSON.stringify(p.icon) + ')">' + p.name + '</span>').join('')}
        </div>
        <label for="tab-cloak-title" style="font-weight: bold;">Set Tab Title:</label><br>
        <input type="text" id="tab-cloak-title" placeholder="Enter new tab name..." oninput="cloakName(this.value)">
        <br><br><br>
        <label for="tab-cloak-icon" style="font-weight: bold;">Set Tab Icon:</label><br>
        <input type="text" id="tab-cloak-icon" placeholder="Enter new tab icon..." oninput='cloakIcon(this.value)'>
        <br><br>
    `;
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
}

const settings = document.getElementById('settings');
if (settings) {
    settings.addEventListener('click', () => {
        document.getElementById('popupTitle').textContent = "Settings";
        const popupBody = document.getElementById('popupBody');
        const saverOn = window.resourceSaver && window.resourceSaver.isOn();
        popupBody.innerHTML = `
        <button class="settings-button" onclick="darkMode()">Toggle Dark Mode</button>
        <br><br>
        <button class="settings-button" onclick="tabCloak()">Tab Cloak</button>
        <br><br>
        <button class="settings-button" id="saverToggle">Resource Saver: ${saverOn ? "ON" : "OFF"}</button>
        <br>
        `;
        const saverBtn = document.getElementById('saverToggle');
        if (saverBtn) saverBtn.addEventListener('click', () => {
            const on = window.resourceSaver.toggle();
            toast(on ? "Resource Saver ON — lite covers & no popularity sync" : "Resource Saver OFF");
            saverBtn.textContent = "Resource Saver: " + (on ? "ON" : "OFF");
            sortZones();
        });
        popupBody.contentEditable = false;
        document.getElementById('popupOverlay').style.display = "flex";
    });
}

function showZoneInfo(file) {
    if (!file) return;
    document.getElementById('popupTitle').textContent = file.name || "Zone";
    const popupBody = document.getElementById('popupBody');
    const desc = file.desc || "No description yet.";
    const tags = (file.tags && file.tags.length) ? file.tags : [];
    popupBody.innerHTML = `
        <p class="zone-desc">${escapeHtml(desc)}</p>
        ${file.author ? '<p class="zone-desc" style="opacity:0.75">By ' + escapeHtml(file.author) + '</p>' : ''}
        ${tags.length ? '<div class="zone-desc-tags">' + tags.map(t => '<span>' + escapeHtml(t) + '</span>').join('') + '</div>' : ''}
        <button class="settings-button" style="margin-top:14px" onclick="openZoneFromInfo(${file.id})">Play</button>
    `;
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
}

function openZoneFromInfo(id) {
    const zone = zones.find(z => z.id === id);
    if (zone) {
        closePopup();
        openZone(zone);
    }
}

function openRequestEnvelope(mode, zone) {
    const overlay = document.getElementById('envelopeOverlay');
    if (!overlay) return;
    const widget = document.getElementById('envwWidget');
    if (widget) {
        widget.dataset.mode = mode || 'request';
        widget.dataset.zoneId = zone && zone.id != null ? String(zone.id) : '';
    }
    const resetBtn = document.getElementById('envwReset');
    if (resetBtn) resetBtn.click();
    const gameInput = document.getElementById('envwGame');
    const btn = document.getElementById('envwBtn');
    if (btn) btn.textContent = (mode === 'report') ? 'Send Report' : 'Seal & Send';
    if (mode === 'report' && zone && gameInput) gameInput.value = zone.name;
    overlay.classList.add('open');
    setTimeout(() => {
        const input = document.getElementById('envwGame');
        if (input) input.focus();
    }, 60);
}

function closeEnvelope() {
    const overlay = document.getElementById('envelopeOverlay');
    if (overlay) overlay.classList.remove('open');
}

document.addEventListener('game-request:sent', (event) => {
    const detail = event.detail || {};
    const widget = document.getElementById('envwWidget');
    const mode = widget ? widget.dataset.mode : 'request';
    const zoneId = widget ? widget.dataset.zoneId : '';
    const zoneName = mode === 'report' && zoneId ? ((zones.find(z => z.id === Number(zoneId)) || {}).name || '') : '';
    const content = (mode === 'report' ? 'REPORT' : 'REQUEST') + ' | game: ' + (detail.game || '') + (detail.link ? ' | link: ' + detail.link : '') + (detail.notes ? ' | notes: ' + detail.notes : '') + (zoneName ? ' | zone: ' + zoneName : '');
    fetch(REQUEST_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'TheFreedomZone', content: content })
    }).then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        toast('Request sent - thanks!');
    }).catch(() => {
        toast("Couldn't send - check connection.");
    });
});

(function(){
  // ---- silence the benign "ResizeObserver loop completed with undelivered
  // notifications" browser warning so it doesn't surface as an uncaught error
  // in your site's console. It never indicates broken functionality here —
  // this widget doesn't use ResizeObserver itself, but hosts that auto-size
  // an iframe around it sometimes trip this Chrome/Safari quirk.
  window.addEventListener('error', function (e) {
    if (e && typeof e.message === 'string' && e.message.includes('ResizeObserver loop')) {
      e.stopImmediatePropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
  });

  var widget    = document.getElementById('envwWidget');
  var fling     = document.getElementById('envwFling');
  var envelope  = document.getElementById('envwEnvelope');
  var paper     = document.getElementById('envwPaper');
  var gameField = document.getElementById('envwGameField');
  var gameInput = document.getElementById('envwGame');
  var linkInput = document.getElementById('envwLink');
  var notesInput= document.getElementById('envwNotes');
  var btn       = document.getElementById('envwBtn');
  var sentMsg   = document.getElementById('envwSent');
  var status    = document.getElementById('envwStatus');
  var sealed    = false;

  function runSequence(steps){
    var t = 0;
    steps.forEach(function(step){
      t += step[0];
      setTimeout(step[1], t);
    });
  }

  btn.addEventListener('click', function(){
    if (sealed) return;

    var game  = gameInput.value.trim();
    var link  = linkInput.value.trim();
    var notes = notesInput.value.trim();

    if (!game) {
      gameField.classList.add('envw-invalid');
      paper.classList.remove('envw-shake');
      // restart the shake animation
      void paper.offsetWidth;
      paper.classList.add('envw-shake');
      status.textContent = 'Enter a game name first.';
      status.classList.add('envw-error');
      gameInput.focus();
      return;
    }

    gameField.classList.remove('envw-invalid');
    status.classList.remove('envw-error');

    sealed = true;
    gameInput.disabled = true;
    linkInput.disabled = true;
    notesInput.disabled = true;
    btn.disabled = true;
    status.textContent = 'Sealing your request…';

    envelope.classList.add('envw-sealing');

    runSequence([
      [560, function(){ envelope.classList.add('envw-stamped'); status.textContent = 'Stamping the seal…'; }],
      [420, function(){ btn.classList.add('envw-hide'); fling.classList.add('envw-windup'); }],
      [160, function(){
        fling.classList.remove('envw-windup');
        fling.classList.add('envw-thrown');
        status.textContent = 'Sending…';
      }],
      [650, function(){
        sentMsg.hidden = false;
        status.textContent = 'Sent.';
        widget.dispatchEvent(new CustomEvent('game-request:sent', {
          bubbles: true,
          detail: { game: game, link: link, notes: notes }
        }));
      }]
    ]);
  });

  document.getElementById('envwReset').addEventListener('click', function(){
    sealed = false;
    gameInput.disabled = false;
    linkInput.disabled = false;
    notesInput.disabled = false;
    gameInput.value = '';
    linkInput.value = '';
    notesInput.value = '';
    gameField.classList.remove('envw-invalid');
    btn.disabled = false;
    btn.classList.remove('envw-hide');
    envelope.classList.remove('envw-sealing', 'envw-stamped');
    fling.classList.remove('envw-thrown', 'envw-windup');
    sentMsg.hidden = true;
    status.textContent = '';
    status.classList.remove('envw-error');
    gameInput.focus();
  });
})();

function showContact() {
    document.getElementById('popupTitle').textContent = "Contact";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `
    <p>Discord: https://discord.gg/NAFw4ykZ7n</p>
    <p>Email: gn.math.business@gmail.com</p>`;
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
}

function loadPrivacy() {
    document.getElementById('popupTitle').textContent = "Privacy Policy";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto;">
            <h2>PRIVACY POLICY</h2>
            <p>Last updated April 17, 2025</p>
            <p>This Privacy Notice for TheFreedomZone ("we," "us," or "our"), describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you:</p>
            <ul>
                <li>Visit our website at <a href="https://genizymath.github.io" target="_blank" rel="noopener">https://genizymath.github.io</a>, or any website of ours that links to this Privacy Notice</li>
                <li>Engage with us in other related ways, including any sales, marketing, or events</li>
            </ul>
            <p>Questions or concerns? Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a href="https://discord.gg/NAFw4ykZ7n" target="_blank" rel="noopener">https://discord.gg/NAFw4ykZ7n</a>.</p>
            
            <h3>SUMMARY OF KEY POINTS</h3>
            <p>This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for.</p>
            
            <p><strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with you and the Services, the choices you make, and the features you use. Learn more about personal information you disclose to us.</p>
            
            <p><strong>Do we process any sensitive personal information?</strong> Some of the information may be considered "special" or "sensitive" in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.</p>
            
            <p><strong>Do we collect any information from third parties?</strong> We do not collect any information from third parties.</p>
            
            <p><strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. Learn more about how we process your information.</p>
            
            <p><strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties. Learn more about when and with whom we share your personal information.</p>
            
            <p><strong>How do we keep your information safe?</strong> We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Learn more about how we keep your information safe.</p>
            
            <p><strong>What are your rights?</strong> Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. Learn more about your privacy rights.</p>
            
            <p><strong>How do you exercise your rights?</strong> The easiest way to exercise your rights is by submitting a data subject access request, or by contacting us. We will consider and act upon any request in accordance with applicable privacy law.</p>
        </div>
    `;
    popupBody.contentEditable = false;
    document.getElementById('popupOverlay').style.display = "flex";
}

function closePopup() {
    document.getElementById('popupOverlay').style.display = "none";
}

const zoneCloseBtn = document.getElementById('zoneClose');
const zoneBackBtn = document.getElementById('zoneBack');
const zoneFullscreenBtn = document.getElementById('zoneFullscreen');
const zoneCopyBtn = document.getElementById('zoneCopy');
const zoneExternalBtn = document.getElementById('zoneExternal');
const zoneReportBtn = document.getElementById('zoneReport');
const randomZoneBtn = document.getElementById('randomZone');
const continueZoneBtn = document.getElementById('continueZone');
if (zoneCloseBtn) zoneCloseBtn.addEventListener('click', closeViewer);
if (zoneBackBtn) zoneBackBtn.addEventListener('click', goBack);
if (zoneFullscreenBtn) zoneFullscreenBtn.addEventListener('click', toggleViewerFullscreen);
if (zoneCopyBtn) zoneCopyBtn.addEventListener('click', copyZoneLink);
if (zoneExternalBtn) zoneExternalBtn.addEventListener('click', openExternalTab);
if (randomZoneBtn) randomZoneBtn.addEventListener('click', openRandomZone);
if (zoneReportBtn) zoneReportBtn.addEventListener('click', () => {
    openRequestEnvelope('report', currentZone);
});
if (continueZoneBtn) continueZoneBtn.addEventListener('click', continuePlaying);

function updateContinueButton() {
    const btn = document.getElementById('continueZone');
    if (!btn) return;
    const last = loadFromStorage(LAST_KEY, null);
    if (last && last.name) {
        btn.style.display = 'inline-block';
        btn.title = 'Continue playing: ' + last.name;
    } else {
        btn.style.display = 'none';
    }
}

function continuePlaying() {
    const last = loadFromStorage(LAST_KEY, null);
    if (!last) return;
    const zone = zones.find(z => z.id === last.id) ||
        (last.url ? { name: last.name, url: last.url, cover: last.cover } : null);
    if (zone) openZone(zone);
}

const envelopeOverlay = document.getElementById('envelopeOverlay');
if (envelopeOverlay) {
    envelopeOverlay.addEventListener('click', (event) => {
        if (event.target === envelopeOverlay || event.target.classList.contains('envelope-close')) {
            closeEnvelope();
        }
    });
}
document.addEventListener('keydown', (event) => {
    const viewerOpen = document.getElementById('zoneViewer').classList.contains('open');
    if (event.key === 'Escape' && viewerOpen) {
        closeViewer();
    }
    if (event.key === 'Escape' && document.activeElement === searchBar) {
        searchBar.value = "";
        filterZones();
    }
    const target = event.target;
    const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (event.key === '/' && !isTyping && document.activeElement !== searchBar) {
        event.preventDefault();
        searchBar.focus();
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping || viewerOpen) return;
    const k = (event.key || "").toLowerCase();
    if (k === 'r') {
        event.preventDefault();
        openRandomZone();
    } else if (k === 'c') {
        event.preventDefault();
        continuePlaying();
    } else if (k === 'f') {
        event.preventDefault();
        const favEl = document.getElementById('favZonesWrapper');
        if (favEl) {
            favEl.setAttribute("open", "");
            favEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else if (k === 't') {
        event.preventDefault();
        openRequestEnvelope('request');
    }
});
applySavedTheme();
if (window.fzGate) {
    window.fzGate.boot(() => listZones());
} else {
    listZones();
}
