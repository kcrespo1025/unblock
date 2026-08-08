const container = document.getElementById('container');
const searchBar = document.getElementById('searchBar');
const sortOptions = document.getElementById('sortOptions');
// https://www.jsdelivr.com/tools/purge
const zonesURL = "https://cdn.jsdelivr.net/gh/freebuisness/assets@main/zones.json";
const coverURL = "https://cdn.jsdelivr.net/gh/freebuisness/covers@main";
const htmlURL = "https://cdn.jsdelivr.net/gh/freebuisness/html@main";
const OFFICIAL_URL = "https://daily-light-bible.fisherrivar32.chatgpt.site/";
const RECENT_KEY = "fz_recent";
const FAVS_KEY = "fz_favs";
const THEME_KEY = "fz_dark";
const CACHE_KEY = "fz_zones_cache";
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
let favs = new Set(loadFromStorage(FAVS_KEY, []));

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
        let json;
        try {
            const response = await fetch(zonesURL);
            json = await response.json();
            saveToStorage(CACHE_KEY, json);
        } catch (fetchError) {
            const cached = loadFromStorage(CACHE_KEY, null);
            if (!cached) throw fetchError;
            json = cached;
        }
        zones = json;
        zones = zones.filter(zone => !/^\[!\]\s*comments$/i.test(zone.name || "") && zone.id !== 596);
        const discordZone = zones.find(zone => zone.url === "https://discord.gg/D4c9VFYWyU");
        if (discordZone) {
            discordZone.name = "TheFreedomZoneServer";
            discordZone.url = "https://discord.gg/y4naww23Y9";
        }
        zones.push({
            id: -1,
            name: "Forge Code",
            cover: "Logo.png",
            url: "special/Forge Code/Forge Code.html",
            featured: true
        });
        zones.push({
            id: -2,
            name: "Underground",
            cover: "special/Underground/LOGO.png",
            url: "special/Underground/Underground.html?standalone=1",
            featured: true
        });
        zones.push({
            id: -3,
            name: "Daily Light",
            cover: "special/daily-light-bible/LOGO.webp",
            url: OFFICIAL_URL,
            fallbackUrl: "special/daily-light-bible/index.html",
            featured: true,
            mustCheck: true
        });
        const localGames = [
            { name: "67 Clicker", cover: "special/games/covers/846.png", url: "special/games/846.html" },
            { name: "Archers", cover: "special/games/covers/847.png", url: "special/games/847.html" },
            { name: "Break It All", cover: "special/games/covers/848.png", url: "special/games/848.html" },
            { name: "Case-Battle", cover: "special/games/covers/849.png", url: "special/games/849.html" },
            { name: "Clash", cover: "special/games/covers/850.png", url: "special/games/850.html" },
            { name: "Climb Hard", cover: "special/games/covers/851.png", url: "special/games/851.html" },
            { name: "CS 2 Surf", cover: "special/games/covers/852.png", url: "special/games/852.html" },
            { name: "Dash.io", cover: "special/games/covers/853.png", url: "special/games/853.html" },
            { name: "Diep io", cover: "special/games/covers/854.png", url: "special/games/854.html" },
            { name: "Doblox 2", cover: "special/games/covers/855.png", url: "special/games/855.html" },
            { name: "Doblox: Chameleon", cover: "special/games/covers/856.png", url: "special/games/856.html" },
            { name: "Dune Dash", cover: "special/games/covers/857.png", url: "special/games/857.html" },
            { name: "Bloons supermonkey", cover: "special/games/covers/858.png", url: "special/games/858.html" },
            { name: "FNF 3D", cover: "special/games/covers/859.png", url: "special/games/859.html" },
            { name: "Forest Survival", cover: "special/games/covers/860.png", url: "special/games/860.html" },
            { name: "Fragzone", cover: "special/games/covers/861.png", url: "special/games/861.html" },
            { name: "Gta Mods", cover: "special/games/covers/862.png", url: "special/games/862.html" },
            { name: "Gta", cover: "special/games/covers/863.png", url: "special/games/863.html" },
            { name: "Hole Battle", cover: "special/games/covers/864.png", url: "special/games/864.html" },
            { name: "Keyboard Escape", cover: "special/games/covers/865.png", url: "special/games/865.html" },
            { name: "Knife Hit", cover: "special/games/covers/866.png", url: "special/games/866.html" },
            { name: "Ks2 Teams", cover: "special/games/covers/867.png", url: "special/games/867.html" },
            { name: "level 2", cover: "special/games/covers/868.png", url: "special/games/868.html" },
            { name: "Lobby Battle", cover: "special/games/covers/869.png", url: "special/games/869.html" },
            { name: "Mr.Dude", cover: "special/games/covers/870.png", url: "special/games/870.html" },
            { name: "Obby", cover: "special/games/covers/871.png", url: "special/games/871.html" },
            { name: "Only Up!", cover: "special/games/covers/872.png", url: "special/games/872.html" },
            { name: "Race 2", cover: "special/games/covers/873.png", url: "special/games/873.html" },
            { name: "Raven 3D", cover: "special/games/covers/874.png", url: "special/games/874.html" },
            { name: "Real Kart", cover: "special/games/covers/875.png", url: "special/games/875.html" },
            { name: "Soccer 2026!", cover: "special/games/covers/876.png", url: "special/games/876.html" },
            { name: "Super knife", cover: "special/games/covers/877.png", url: "special/games/877.html" },
            { name: "Race", cover: "special/games/covers/878.png", url: "special/games/878.html" },
            { name: "Tank Flow", cover: "special/games/covers/879.png", url: "special/games/879.html" },
            { name: "Tap Goal", cover: "special/games/covers/880.png", url: "special/games/880.html" },
            { name: "Wave 3D", cover: "special/games/covers/881.png", url: "special/games/881.html" },
            { name: "Your Life Simulator", cover: "special/games/covers/882.png", url: "special/games/882.html" },
            { name: "Zomblox", cover: "special/games/covers/883.png", url: "special/games/883.html" },
        ];
        localGames.forEach((game, i) => zones.push({ id: -1001 - i, ...game }));
        try {
            if (typeof harvestLocalGames !== 'undefined') {
                harvestLocalGames.forEach((game, i) => zones.push({ id: -1039 - i, ...game }));
            }
            if (typeof harvestExternalGames !== 'undefined') {
                harvestExternalGames.forEach((game, i) => zones.push({ id: -2001 - i, ...game }));
            }
            if (typeof harvestFalloutGames !== 'undefined') {
                harvestFalloutGames.forEach((game, i) => zones.push({ id: -3001 - i, ...game }));
            }
        } catch (error) {
            console.error(error);
        }
        if (typeof openSourceCatalog !== 'undefined') {
            openSourceCatalog.forEach((entry, i) => zones.push({ id: -4001 - i, ...entry }));
        }
        zones[0].featured = true; // always gonna be the discord
        await fetchPopularity();
        sortZones();
        renderRecent();
        renderFavorites();
        renderOpenSourcePrograms();
        updateZoneCount();
        const search = new URLSearchParams(window.location.search);
        const id = search.get('id');
        if (id) {
            const zone = zones.find(zone => zone.id + '' == id + '');
            if (zone) {
                openZone(zone);
            }
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = `Error loading zones: ${error}`;
    }
}
async function fetchPopularity() {
    try {
        const response = await fetch("https://data.jsdelivr.com/v1/stats/packages/gh/freebuisness/html@main/files?period=year");
        const data = await response.json();
        data.forEach(file => {
            const idMatch = file.name.match(/\/(\d+)\.html$/);
            if (idMatch) {
                const id = parseInt(idMatch[1]);
                popularityData[id] = file.hits.total;
            }
        });
    } catch (error) {
        popularityData[0] = 0;
    }
}

function updateZoneCount() {
    const el = document.getElementById('zoneCount');
    if (el) el.textContent = zones.length;
}

function sortZones() {
    const sortBy = sortOptions.value;
    if (sortBy === 'name') {
        zones.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'id') {
        zones.sort((a, b) => a.id - b.id);
    } else if (sortBy === 'popular') {
        zones.sort((a, b) => (popularityData[b.id] || 0) - (popularityData[a.id] || 0));
    }
    zones.sort((a, b) => (a.id === -1 ? -1 : b.id === -1 ? 1 : 0));
    if (featuredContainer.innerHTML === "") {
        const featured = zones.filter(z => z.featured);
        displayFeaturedZones(featured);
    }
    if (mustCheckContainer.innerHTML === "") {
        const mustCheck = zones.filter(z => z.mustCheck);
        displayMustCheckZones(mustCheck);
    }
    displayZones(zones);
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
    img.dataset.src = file.cover.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
    img.alt = file.name;
    img.loading = "lazy";
    img.className = "lazy-zone-img";
    img.onerror = () => {
        if (file.fallbackCover && img.src !== file.fallbackCover) {
            img.src = file.fallbackCover;
            return;
        }
        img.src = "WebLogo/Kmoon.webp";
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
    const button = document.createElement("button");
    button.textContent = file.name + (file.external ? " ↗" : "");
    button.onclick = (event) => {
        event.stopPropagation();
        openZone(file);
    };
    zoneItem.appendChild(button);

    return zoneItem;
}

function attachLazyLoad(containerSelector) {
    const lazyImages = document.querySelectorAll(containerSelector + ' img.lazy-zone-img');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove("lazy-zone-img");
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: "100px",
        threshold: 0.1
    });

    lazyImages.forEach(img => {
        imageObserver.observe(img);
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
        document.getElementById("allZonesSummary").textContent = `Featured Zones (${featuredZones.length})`;
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
        document.getElementById("mustCheckZonesSummary").textContent = `Must Check Out (${mustCheckZones.length})`;
    }

    attachLazyLoad('#mustCheckZones');
}

function renderOpenSourcePrograms() {
    if (!openSourceProgramsContainer) return;
    const programs = zones.filter(zone => zone.category === 'program');
    openSourceProgramsContainer.innerHTML = "";
    programs.forEach(program => openSourceProgramsContainer.appendChild(createZoneItem(program)));
    document.getElementById("openSourceProgramsSummary").textContent =
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
        document.getElementById("allSummary").textContent = `All Zones (${zones.length})`;
    }
    attachLazyLoad('#container');
}

function renderRecent() {
    let recent = loadFromStorage(RECENT_KEY, []);
    recent = recent.map(e => (e && typeof e.file === 'object') ? e : { file: e, plays: 1 });
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
        document.getElementById("recentZonesSummary").textContent = `Recently Played (${merged.length})`;
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
        document.getElementById("favZonesSummary").textContent = `Favorites (${favZones.length})`;
    }
    attachLazyLoad('#favZones');
}

function pushRecent(file) {
    let recent = loadFromStorage(RECENT_KEY, []);
    recent = recent.map(e => (e && typeof e.file === 'object') ? e : { file: e, plays: 1 });
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

function loadZoneIntoFrame(file, recentFile) {
    const url = getZoneURL(file);
    const frame = document.getElementById('zoneFrame');
    frame.onload = () => showLoading(false);
    frame.removeAttribute('srcdoc');
    if (url.startsWith(htmlURL)) {
        loadHTMLIntoViewer(url);
    } else {
        frame.src = url;
    }
    currentFrameUrl = url;
    pushRecent(recentFile || file);
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
        loadZoneIntoFrame(prev);
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
    const url = location.origin + location.pathname + '?id=' + id;
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

function loadHTMLIntoViewer(url) {
    const frame = document.getElementById('zoneFrame');
    frame.removeAttribute('src');
    frame.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;height:100vh;display:grid;place-items:center}</style></head><body><p>Loading game...</p></body></html>';
    fetch(url).then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
    }).then(html => {
        if (!/<base\b/i.test(html)) {
            const dir = url.replace(/\/[^/]*$/, '/');
            html = html.replace(/<\/head>/i, '<base href="' + dir + '">$&');
        }
        frame.srcdoc = html;
    }).catch(error => {
        const dash = url.indexOf('.html-');
        if (dash !== -1) {
            loadHTMLIntoViewer(url.slice(0, dash + 5));
            return;
        }
        frame.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;height:100vh;display:grid;place-items:center}</style></head><body><p>Failed to load game: ' + error + '</p><p style="color:#888;font-size:12px">' + url + '</p></body></html>';
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
    if (file.url) {
        return file.url.replace("{COVER_URL}", coverURL).replace("{HTML_URL}", htmlURL);
    } else {
        return "games/" + file.name
            .replace(/ /g, '-')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-');
    }
}

function filterZones() {
    const query = searchBar.value.toLowerCase();
    const filteredZones = zones.filter(zone => zone.name.toLowerCase().includes(query));
    const searching = query.length !== 0;
    ["featuredZonesWrapper", "mustCheckZonesWrapper", "openSourceProgramsWrapper", "recentZonesWrapper", "favZonesWrapper"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (searching) {
            el.removeAttribute("open");
        } else {
            el.setAttribute("open", "");
        }
    });
    displayZones(filteredZones);
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
                localStorage.setItem(key, parsedData[key]);
            }
        } catch (error) {
        }
        if (cookieData) {
            const cookies = cookieData.split("; ");
            cookies.forEach(cookie => {
                document.cookie = cookie;
            });
        }
        alert("Data loaded");
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

function tabCloak() {
    closePopup();
    document.getElementById('popupTitle').textContent = "Tab Cloak";
    const popupBody = document.getElementById('popupBody');
    popupBody.innerHTML = `
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
        popupBody.innerHTML = `
        <button class="settings-button" onclick="darkMode()">Toggle Dark Mode</button>
        <br><br>
        <button class="settings-button" onclick="tabCloak()">Tab Cloak</button>
        <br>
        `;
        popupBody.contentEditable = false;
        document.getElementById('popupOverlay').style.display = "flex";
    });
}

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

document.getElementById('zoneClose').addEventListener('click', closeViewer);
document.getElementById('zoneBack').addEventListener('click', goBack);
document.getElementById('zoneFullscreen').addEventListener('click', toggleViewerFullscreen);
document.getElementById('zoneCopy').addEventListener('click', copyZoneLink);
document.getElementById('zoneExternal').addEventListener('click', openExternalTab);
document.getElementById('randomZone').addEventListener('click', openRandomZone);
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.getElementById('zoneViewer').classList.contains('open')) {
        closeViewer();
    }
    if (event.key === 'Escape' && document.activeElement === searchBar) {
        searchBar.value = "";
        filterZones();
    }
    if (event.key === '/' && document.activeElement !== searchBar) {
        event.preventDefault();
        searchBar.focus();
    }
});
applySavedTheme();
listZones();
