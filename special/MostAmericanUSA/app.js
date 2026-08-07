const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  muted: false,
  eagleMode: false,
  confettiInFlight: 0,
  fireworksLast: 0,
  freedom: 0,
  freedomCelebrated: false,
  stats: { fireworks: 0, hotDogs: 0, hotDogBest: 0, quizBest: 0, served: 0 },
  statesVisited: [],
  achievements: {},
  pet: { hunger: 100, happy: 100, energy: 100, feeds: 0 },
  grill: { flips: Array(6).fill(0), burnt: Array(6).fill(false), heat: 55 },
  rocket: { holding: false, thrust: 0, raf: 0 },
};

const slogans = {
  website: ["website","internet","homepage","freedom portal","stars-and-stripes site","digital homeland","patriotic domain","liberty.net"],
  vibes:     ["vibes","energy","spirit","maximum hype","good times","patriotic frequencies","freedom frequencies","American energy"],
  nation:    ["nation","land","place","zone","great big area","beautiful country","land of the free","home of the brave"],
  fireworks: ["fireworks","glitter","sparkles","laser eagles","dramatic lighting","explosions of joy","rockets' red glare"],
  liberty:   ["liberty","justice","friendship","high-fives","equal snacks","freedom hugs","patriotic hugs","American pride"],
  snacks:    ["snacks","burgers","fries","lemonade","nachos","apple pie","hot dogs","BBQ ribs","pulled pork","cornbread","coleslaw"],
};

const americanQuotes = [
  { q: "Give me liberty, or give me a really good cheeseburger.", attr: "— Probably Someone, 1776" },
  { q: "Ask not what your country can do for you — ask what snacks your country has.", attr: "— The Grill Master" },
  { q: "We hold these truths to be self-evident: that all burgers are created equal.", attr: "— Declaration of Deliciousness" },
  { q: "Four score and seven hot dogs ago...", attr: "— Gettysburg Cookout Address" },
  { q: "The only thing we have to fear is running out of ketchup.", attr: "— FDR, probably" },
  { q: "One small flip for a burger, one giant serve for backyard-kind.", attr: "— Neil Grill-strong" },
  { q: "I have a dream — that one day this nation will fire up the grill together.", attr: "— MLK Jr. (paraphrased loosely)" },
  { q: "Float like a butterfly, sting like a bald eagle.", attr: "— Muhammad Ali (eagle remix)" },
  { q: "To infinity and beyond — but first, fireworks.", attr: "— Buzz Lightyear, American Icon" },
  { q: "Life, liberty, and the pursuit of perfectly grilled ribs.", attr: "— The Constitution (spirit of)" },
  { q: "That's one small click for a button, one giant firework for the website.", attr: "— Neil Armstrong (website edition)" },
  { q: "E pluribus unum. Out of many, one enormous BBQ.", attr: "— The Great Seal (translated freely)" },
  { q: "We are the home of the free and the land of the brave because we said so.", attr: "— The Vibe Check" },
  { q: "This bud's for you, America.", attr: "— Every Commercial, Ever" },
  { q: "I can't believe it's not butter, but I can believe it's freedom.", attr: "— Consumer Advisory" },
  { q: "Don't let your dreams be dreams. Unless they're dreams about freedom. Then make them real.", attr: "— The Gym Rat" },
  { q: "You miss 100% of the shots you don't take. Also applies to fireworks.", attr: "— Wayne Gretzky (probably)" },
];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const setPressed = (btn, pressed) => btn.setAttribute("aria-pressed", String(pressed));

// --- tiny sound synth ---
const audio = (() => {
  const ctx = typeof AudioContext !== "undefined" ? new AudioContext() : null;
  const beep = ({ f = 440, t = 0.06, type = "sine", g = 0.05, detune = 0 } = {}) => {
    if (!ctx || state.muted) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const o = ctx.createOscillator(), gain = ctx.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    gain.gain.value = 0.0001;
    o.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(g, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t);
    o.start(now); o.stop(now + t + 0.02);
  };
  const melodicBeep = ({ f = 440, duration = 200 } = {}) => {
    if (!ctx || state.muted) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = f;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
  };
  const pop = () => beep({ f: 800, t: 0.08, g: 0.12 });
  const chirp = () => beep({ f: 1200, t: 0.1, g: 0.1 });
  const boom = () => { beep({ f: 150, t: 0.3, g: 0.25 }); beep({ f: 100, t: 0.35, g: 0.2, detune: -12 }); };
  const eagle = () => { beep({ f: 2400, t: 0.12, g: 0.15 }); setTimeout(() => beep({ f: 2100, t: 0.15, g: 0.12 }), 200); };
  const anthem = () => {
    const notes = [262, 294, 330, 349, 392, 440, 494]; // C-D-E-F-G-A-B
    notes.forEach((f, i) => setTimeout(() => melodicBeep({ f, duration: 300 }), i * 350));
  };
  return { beep, pop, chirp, boom, eagle, anthem };
})();

// --- confetti ---
const confettiLayer = $("#confetti-layer");
const confettiColors = ["#e11d48","#ffffff","#1d4ed8","#fbbf24","#0ea5e9","#ff6b35","#c8102e"];

function launchConfetti(count=160) {
  if (!confettiLayer) return;
  const max = state.eagleMode ? 320 : 200;
  const actual = clamp(count, 20, max);
  const w = window.innerWidth, h = window.innerHeight;
  state.confettiInFlight += actual;
  for (let i = 0; i < actual; i++) {
    const el = document.createElement("i");
    el.className = "confetti";
    el.style.left = Math.random() * w + "px";
    el.style.top = (-20 - Math.random() * 120) + "px";
    el.style.background = rand(confettiColors);
    el.style.opacity = (0.75 + Math.random() * 0.25).toFixed(2);
    const dx = (Math.random() - 0.5) * 280;
    const dy = h + (Math.random() * 200);
    const rot = (Math.random() * 720 - 360);
    const dur = 1600 + Math.random() * 1400;
    el.animate(
      [{ transform:`translate3d(0,0,0) rotate(0deg)` },
       { transform:`translate3d(${dx*.5}px,${dy*.55}px,0) rotate(${rot*.55}deg)` },
       { transform:`translate3d(${dx}px,${dy}px,0) rotate(${rot}deg)` }],
      { duration:dur, easing:"cubic-bezier(.2,.8,.2,1)", fill:"forwards" }
    );
    confettiLayer.appendChild(el);
    setTimeout(() => { el.remove(); state.confettiInFlight = Math.max(0, state.confettiInFlight-1); }, dur+50);
  }
  audio.pop();
}

// --- fireworks canvas ---
const canvas = $("#sky");
const ctx = canvas ? canvas.getContext("2d") : null;
let fw = [], sparks = [], anim = 0;

function resizeCanvas() {
  if (!canvas) return;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  if (ctx) ctx.setTransform(dpr,0,0,dpr,0,0);
}

function spawnFirework(x=Math.random()*window.innerWidth, y=window.innerHeight*(0.12+Math.random()*0.3)) {
  fw.push({ x, y:window.innerHeight+10, tx:x+(Math.random()-0.5)*60, ty:y,
    vx:(Math.random()-0.5)*1.1, vy:-(5.8+Math.random()*2.2), life:0, burst:false,
    hue:Math.floor(Math.random()*360) });
}

function burstAt(x, y, hue=Math.floor(Math.random()*360)) {
  const n = state.eagleMode ? 160 : 100;
  for (let i=0; i<n; i++) {
    const a = (i/n)*Math.PI*2+(Math.random()*0.2);
    const sp = 1.2+Math.random()*3.8;
    sparks.push({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:0,
      max:52+Math.random()*34, hue:(hue+(Math.random()*40-20))%360,
      s:0.9+Math.random()*0.1, b:0.55+Math.random()*0.45 });
  }
  audio.boom();
}

function tickFireworks() {
  if (!ctx||!canvas) return;
  ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
  const starCount = state.eagleMode ? 100 : 65;
  for (let i=0; i<starCount; i++) {
    const sx=(i*97)%window.innerWidth, sy=(i*151)%window.innerHeight;
    const tw=0.55+0.45*Math.sin((performance.now()/600)+i);
    ctx.globalAlpha=0.10+tw*0.12; ctx.fillStyle="#ffffff";
    ctx.fillRect(sx,sy,2,2);
  }
  for (const r of fw) {
    r.life++; r.x+=r.vx; r.y+=r.vy; r.vy+=0.06;
    r.x=r.x+(r.tx-r.x)*0.03; r.y=r.y+(r.ty-r.y)*0.03;
    ctx.globalAlpha=0.85; ctx.strokeStyle=`hsla(${r.hue},100%,65%,.75)`;
    ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(r.x,r.y+10); ctx.lineTo(r.x,r.y+26); ctx.stroke();
    ctx.globalAlpha=1; ctx.fillStyle=`hsla(${r.hue},100%,70%,1)`;
    ctx.beginPath(); ctx.arc(r.x,r.y,2.2,0,Math.PI*2); ctx.fill();
    const t=clamp(r.life/28,0,1);
    if (!r.burst&&(t>=1||r.y<=r.ty+6)) { r.burst=true; burstAt(r.x,r.y,r.hue); }
  }
  fw=fw.filter(r=>!r.burst);
  for (const s of sparks) {
    s.life++; s.x+=s.vx; s.y+=s.vy; s.vy+=0.03; s.vx*=0.985; s.vy*=0.985;
    const fade=1-(s.life/s.max);
    ctx.globalAlpha=clamp(fade,0,1)*0.95;
    ctx.fillStyle=`hsla(${s.hue},${Math.floor(s.s*100)}%,${Math.floor(55+s.b*35)}%,1)`;
    ctx.beginPath(); ctx.arc(s.x,s.y,1.6,0,Math.PI*2); ctx.fill();
  }
  sparks=sparks.filter(s=>s.life<s.max);
  ctx.globalAlpha=1;
  anim=requestAnimationFrame(tickFireworks);
}

function ensureFireworksLoop() { if (!ctx||anim) return; tickFireworks(); }

function fireworksBurst(count=5) {
  const now=performance.now();
  if (now-state.fireworksLast<250) return;
  state.fireworksLast=now;
  ensureFireworksLoop();
  const actual=clamp(count,1,state.eagleMode?12:7);
  for (let i=0;i<actual;i++) spawnFirework();
}

// --- oath ---
const oathText = $("#oathText");
function bindOath() {
  if (!oathText) return;
  oathText.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-chip]");
    if (!btn) return;
    const key = btn.getAttribute("data-chip");
    btn.textContent = rand(slogans[key]||["freedom"]);
    audio.chirp();
    addFreedom(3);
  });
}
function resetOath() {
  if (!oathText) return;
  $$(".chip", oathText).forEach(b => {
    const key = b.getAttribute("data-chip");
    b.textContent = (slogans[key]||[b.textContent])[0];
  });
}

// --- grill ---
const heat = $("#heat"), heatFill = $("#heatFill"), heatLabel = $("#heatLabel"), grillMsg = $("#grillMsg");

function setHeat(v) {
  state.grill.heat = clamp(v,0,100);
  if (heatFill) heatFill.style.width = `${state.grill.heat}%`;
  if (!heatLabel) return;
  if (state.grill.heat < 34) heatLabel.textContent = "Low";
  else if (state.grill.heat < 70) heatLabel.textContent = "Medium";
  else heatLabel.textContent = "🔥 HIGH";
}

function flipBurger(i, el) {
  state.grill.flips[i] += 1;
  el.classList.toggle("is-flipped");
  const tooHot = state.grill.heat > 78;
  const tooManyFlips = state.grill.flips[i] > 5;
  state.grill.burnt[i] = tooHot && tooManyFlips;
  el.classList.toggle("is-burnt", state.grill.burnt[i]);
  audio.pop();
  addFreedom(1);
  if (grillMsg) grillMsg.textContent = state.grill.burnt[i]
    ? "That one has achieved charcoal sadness. Consider restocking."
    : "Flip registered. Grill responsibly, patriot.";
}

function restock() {
  state.grill.flips = [0,0,0,0,0,0];
  state.grill.burnt = [false,false,false,false,false,false];
  $$(".burger").forEach(b => b.classList.remove("is-burnt","is-flipped"));
  if (grillMsg) grillMsg.textContent = "Fresh burgers and hot dogs deployed. Godspeed.";
  audio.chirp();
}

function addCorn() {
  const rack = $("#grillRack");
  if (!rack) return;
  const existing = $$(".corn-item", rack);
  if (existing.length >= 2) { if (grillMsg) grillMsg.textContent = "Grill is full of corn. America is proud."; return; }
  const btn = document.createElement("button");
  btn.className = "burger corn-item"; btn.type = "button"; btn.textContent = "🌽";
  btn.setAttribute("aria-label", "Corn on the cob");
  btn.addEventListener("click", () => { btn.classList.toggle("is-flipped"); audio.pop(); addFreedom(2); });
  rack.appendChild(btn);
  if (grillMsg) grillMsg.textContent = "Corn added. This is peak America.";
  audio.chirp(); addFreedom(5);
}

function serve() {
  const burnt = state.grill.burnt.filter(Boolean).length;
  const flips = state.grill.flips.reduce((a,b)=>a+b,0);
  const total = 6;
  const msg = burnt===0
    ? `Plate served: ${total} perfect items. Flips: ${flips}. America fed.`
    : `Plate served: ${total-burnt} good + ${burnt} "well done" artifacts. No judgment.`;
  if (grillMsg) grillMsg.textContent = msg;
  launchConfetti(burnt===0?140:80);
  audio.boom();
  bumpBurgerKpi(burnt===0?3:1);
  addFreedom(burnt===0?20:8);
  if (burnt === 0) {
    state.stats.served += 1;
    persist();
    unlock("grill-perfect");
  }
}

// --- rocket ---
const rocketShip=$("#rocketShip"), thrustFill=$("#thrustFill"), thrustLabel=$("#thrustLabel"),
      rocketMsg=$("#rocketMsg"), flame=$("#flame");

function setThrust(v) {
  state.rocket.thrust=clamp(v,0,100);
  if (thrustFill) thrustFill.style.width=`${state.rocket.thrust}%`;
  if (thrustLabel) thrustLabel.textContent=`${Math.round(state.rocket.thrust)}%`;
  if (flame) flame.style.opacity=state.rocket.thrust>0?"1":"0";
}
function rocketArm(armed) { if (rocketShip) rocketShip.classList.toggle("is-armed",armed); }
function rocketAbort(msg="Launch aborted. Democracy of the thumb achieved.") {
  state.rocket.holding=false; rocketArm(false);
  cancelAnimationFrame(state.rocket.raf); state.rocket.raf=0;
  setThrust(0);
  if (rocketShip) rocketShip.classList.remove("is-launching");
  if (rocketMsg) rocketMsg.textContent=msg;
  audio.pop();
}
function rocketHoldStart() {
  if (!rocketShip) return;
  state.rocket.holding=true; rocketArm(true);
  if (rocketMsg) rocketMsg.textContent="Holding… building thrust. (Still fake.)";
  const start=performance.now();
  const loop=()=>{
    if (!state.rocket.holding) return;
    const t=clamp((performance.now()-start)/1200,0,1);
    setThrust(t*100);
    if (t>=1) { rocketLaunch(); return; }
    state.rocket.raf=requestAnimationFrame(loop);
  };
  state.rocket.raf=requestAnimationFrame(loop);
}
function rocketLaunch() {
  state.rocket.holding=false; rocketArm(true);
  if (rocketShip) rocketShip.classList.add("is-launching");
  if (rocketMsg) rocketMsg.textContent="🚀 LIFTOFF (artist's impression).";
  audio.boom();
  launchConfetti(state.eagleMode?280:190);
  fireworksBurst(state.eagleMode?10:6);
  bumpFreedomKpi(25); addFreedom(30);
  unlock("rocket-launch");
  setTimeout(()=>rocketAbort("Rocket returned safely to the CSS realm."),1400);
}

// --- museum plaques ---
const plaqueTitle=$("#plaqueTitle"), plaqueBody=$("#plaqueBody");
const plaques = {
  1:  { t:"LIBERTY (VERY SHINY)", b:"A symbol of big dreams, bold welcomes, and the eternal hope that your Wi‑Fi connects on the first try." },
  2:  { t:"EAGLE (PROFESSIONAL STARES)", b:"Known for majestic vibes and zero interest in your excuses. Activate Eagle Mode for enhanced dramatic energy." },
  3:  { t:"FIREWORKS (SOUND: OPTIONAL)", b:"A tradition of celebratory sparkles. In this website, they're rendered responsibly on a canvas — no neighborhood dogs harmed." },
  4:  { t:"FOOTBALL (STRATEGIC CHAOS)", b:"An elegant dance of tactics, snacks, and shouting at rectangles. Recommended pairing: wings and friendly trash talk." },
  5:  { t:"FRIES (THE DIPLOMACY STICKS)", b:"Salted golden batons of joy. Frequently involved in peace negotiations with ketchup. Sometimes ranch. We do not judge." },
  6:  { t:"ROCK (LOUD HISTORY)", b:"A genre fueled by riffs, rebellion, and the universal need to turn it up slightly too high." },
  7:  { t:"APPLE PIE (NATIONAL TREASURE)", b:"Warm, flaky, and deeply symbolic. Pairs well with vanilla ice cream, a porch swing, and a sunset over the heartland." },
  8:  { t:"COWBOYS (ICONIC SILHOUETTE)", b:"Hat: wide. Boots: pointy. Attitude: legendary. The cowboy is America's original main character." },
  9:  { t:"ROAD TRIP (INFINITE HIGHWAY)", b:"4.07 million miles of asphalt, a full tank of gas, and a playlist that starts strong and gets weird by hour three." },
  10: { t:"HOT DOG (BALLPARK CLASSIC)", b:"A tube of mystery and joy. Consumed at approximately 20 billion units per year. No further questions." },
  11: { t:"BASKETBALL (VERTICAL AMBITION)", b:"A sport of pure elevation — both physical and metaphorical. Invented in a gym. Perfected on a driveway." },
  12: { t:"SPACE (THE FINAL FRONTIER)", b:"America looked at the moon and said 'we'll take it.' Then went there. Twice. With a dune buggy the second time." },
  13: { t:"STATUE OF LIBERTY (COPPER ICON)", b:"A lady holding a torch. Bigger than you thought. Has won the 'most visited national monument' award forever." },
  14: { t:"PIZZA (IMPORTED PERFECTION)", b:"Italy gets credit. But America perfected it. Try proving us wrong. You can't. Pepperoni: non-negotiable." },
  15: { t:"MIC DROP (SILENT VICTORY)", b:"The universal sign of having said something amazing. Peak American confidence. No further explanation needed." },
  16: { t:"BEACH (SAND & FREEDOM)", b:"Coast to coast, America's beaches are where flip-flops meet destiny. Seagulls: local security staff." },
  17: { t:"COWBOY BOOTS (STYLE & FUNCTION)", b:"Perfect for kicking up your feet after a long day. Also perfect for kicking down doors. Mostly the first thing though." },
  18: { t:"HOLLYWOOD (DREAM FACTORY)", b:"We make stories. Big, loud, expensive stories with explosions. The world watches. Stars live here." },
};
function setPlaque(id) {
  const p=plaques[id];
  if (!p||!plaqueTitle||!plaqueBody) return;
  plaqueTitle.textContent=p.t; plaqueBody.textContent=p.b;
  audio.chirp(); addFreedom(5);
}

// --- KPIs ---
const freedomKpi=$("#freedomKpi"), burgerKpi=$("#burgerKpi"), eagleKpi=$("#eagleKpi");
function bumpFreedomKpi(d) { if (!freedomKpi) return; freedomKpi.textContent=String((Number(freedomKpi.textContent)||0)+d); }
function bumpBurgerKpi(d)  { if (!burgerKpi)  return; burgerKpi.textContent=String((Number(burgerKpi.textContent)||0)+d); }
function bumpEagleKpi(d)   { if (!eagleKpi)   return; eagleKpi.textContent=String((Number(eagleKpi.textContent)||0)+d); }

// --- freedom meter ---
const FREEDOM_TIERS = [
  { pct:0,   label:"Keep clicking. America is watching." },
  { pct:10,  label:"A flicker of freedom. Keep going." },
  { pct:25,  label:"Patriotism: warming up." },
  { pct:40,  label:"You're getting there, citizen." },
  { pct:55,  label:"Freedom: Medium-Well." },
  { pct:70,  label:"Stars and stripes are tingling." },
  { pct:85,  label:"EAGLE APPROVED. Almost there." },
  { pct:95,  label:"🦅 MAXIMUM FREEDOM ACHIEVED 🦅" },
  { pct:100, label:"🇺🇸 YOU ARE THE CONSTITUTION 🇺🇸" },
];

function addFreedom(amount) {
  state.freedom = clamp(state.freedom + amount, 0, 100);
  updateFreedomBar();
}

function updateFreedomBar() {
  const fill = $("#freedomBarFill"), label = $("#freedomBarLabel"), tier = $("#freedomTier");
  if (fill) fill.style.width = `${state.freedom}%`;
  if (label) label.textContent = `${Math.round(state.freedom)}% FREE`;
  if (tier) {
    const t = [...FREEDOM_TIERS].reverse().find(t => state.freedom >= t.pct);
    tier.textContent = t ? t.label : FREEDOM_TIERS[0].label;
  }
  if (state.freedom >= 100 && !state.freedomCelebrated) {
    state.freedomCelebrated = true;
    persist();
    unlock("full-freedom");
    fireworksBurst(state.eagleMode?12:8);
    launchConfetti(state.eagleMode?300:200);
    bumpFreedomKpi(100);
  } else if (state.freedom < 100) {
    state.freedomCelebrated = false;
  }
}

// --- quotes ---
let lastQuoteIdx = -1;
function showQuote() {
  let idx;
  do { idx = Math.floor(Math.random() * americanQuotes.length); } while (idx === lastQuoteIdx);
  lastQuoteIdx = idx;
  const q = americanQuotes[idx];
  const qt = $("#quoteText"), qa = $("#quoteAttr");
  if (qt) qt.textContent = `"${q.q}"`;
  if (qa) qa.textContent = q.attr;
}

// --- american facts ---
const americanFacts = [
  "There are 50 states and 13 original colonies represented in the flag.",
  "Americans eat about 20 billion hot dogs per year.",
  "The Statue of Liberty was a gift from France in 1886.",
  "Route 66 stretches over 2,400 miles from Chicago to Los Angeles.",
  "The Grand Canyon is one of the Seven Natural Wonders of the World.",
  "The United States has the world's largest economy.",
  "Native Americans were the first inhabitants of North America.",
  "The first McDonald's opened in 1940 in California.",
  "Niagara Falls produces about 750,000 gallons of water per second.",
  "The Bald Eagle is the national bird and symbol of freedom.",
  "Americans invented the light bulb, airplane, and the internet.",
  "Yellowstone was the first national park in the world.",
  "The Liberty Bell cracked on July 8, 1835.",
  "Las Vegas is the brightest spot on Earth when viewed from space.",
  "The Mississippi River is the second longest river in North America.",
  "Americans consume about 900 million pounds of seafood per year.",
  "The first Super Bowl was played in 1967.",
  "Mount Rushmore has 4 of the greatest presidents carved into it.",
  "There are over 400 areas in the National Park System.",
  "Jazz originated in New Orleans.",
  "The first skyscraper was built in Chicago in 1885.",
  "Americans eat approximately 100 acres of pizza every day.",
  "The flag of the United States has 13 stripes representing the original colonies.",
  "The national anthem is 'The Star-Spangled Banner.'",
  "Area 51 is a highly classified U.S. Air Force facility in Nevada.",
];

let lastFactIdx = -1;
function showFact() {
  let idx;
  do { idx = Math.floor(Math.random() * americanFacts.length); } while (idx === lastFactIdx);
  lastFactIdx = idx;
  const ft = $("#factText");
  if (ft) ft.textContent = americanFacts[idx];
  addFreedom(2);
}

// --- eagle mode flying eagle ---
function flyEagle() {
  const el = $("#flyingEagle");
  if (!el) return;
  el.classList.add("is-flying");
  bumpEagleKpi(1);
  audio.eagle();
  setTimeout(() => el.classList.remove("is-flying"), 3200);
}

// --- global toggles ---
function toggleEagleMode() {
  state.eagleMode = !state.eagleMode;
  document.body.classList.toggle("eagle-mode", state.eagleMode);
  const btn = $("#eagle");
  if (btn) btn.textContent = state.eagleMode ? "🦅 Eagle Mode: ON" : "Eagle Mode";
  bumpFreedomKpi(state.eagleMode?15:-3);
  addFreedom(state.eagleMode?20:-5);
  if (state.eagleMode) { launchConfetti(160); flyEagle(); fireworksBurst(6); unlock("eagle-mode"); }
  else audio.chirp();
}
function toggleMute() {
  state.muted = !state.muted;
  const btn = $("#mute");
  if (btn) { btn.textContent = state.muted ? "Sound: OFF" : "Sound: ON"; setPressed(btn, !state.muted); }
}
function toggleFlagWave() {
  const on = !document.body.classList.contains("flag-wave");
  document.body.classList.toggle("flag-wave", on);
  const b = $("#flagwave");
  if (b) setPressed(b, on);
  audio.pop(); addFreedom(5);
}

// --- wiring ---
function bindUI() {
  $("#launch")?.addEventListener("click", () => { unlock("first-firework"); fireworksBurst(state.eagleMode?10:6); addFreedom(8); });
  $("#confetti")?.addEventListener("click", () => { launchConfetti(state.eagleMode?280:180); addFreedom(5); });
  $("#playAnthem")?.addEventListener("click", () => { audio.anthem(); addFreedom(10); bumpFreedomKpi(5); });
  $("#grandFinale")?.addEventListener("click", () => {
    fireworksBurst(state.eagleMode?12:8);
    setTimeout(()=>fireworksBurst(state.eagleMode?12:8),400);
    setTimeout(()=>fireworksBurst(state.eagleMode?12:8),900);
    setTimeout(()=>fireworksBurst(state.eagleMode?12:8),1400);
    launchConfetti(state.eagleMode?320:220);
    bumpFreedomKpi(100); addFreedom(50);
    if (state.eagleMode) flyEagle();
  });

  $("#eagle")?.addEventListener("click", toggleEagleMode);
  $("#mute")?.addEventListener("click", toggleMute);
  $("#flagwave")?.addEventListener("click", toggleFlagWave);

  $("#oathBoost")?.addEventListener("click", () => {
    fireworksBurst(state.eagleMode?8:5);
    launchConfetti(state.eagleMode?240:150);
    bumpFreedomKpi(15); addFreedom(15);
  });
  $("#oathReset")?.addEventListener("click", () => { resetOath(); audio.pop(); });

  // Grill
  setHeat(state.grill.heat);
  heat?.addEventListener("input", e => setHeat(Number(e.target.value)));
  $$(".burger").forEach(b => b.addEventListener("click", () => {
    const i = Number(b.getAttribute("data-burger")||"0");
    flipBurger(i, b);
  }));
  $("#restock")?.addEventListener("click", restock);
  $("#serve")?.addEventListener("click", serve);
  $("#addCorn")?.addEventListener("click", addCorn);

  // Rocket
  const holdBtn = $("#holdLaunch");
  const pressStart = e => { e.preventDefault(); if (!state.rocket.holding) rocketHoldStart(); };
  const pressEnd   = e => { e.preventDefault(); if (state.rocket.holding) rocketAbort("Launch cancelled. Your thumb is the real hero."); };
  holdBtn?.addEventListener("pointerdown", pressStart);
  holdBtn?.addEventListener("pointerup", pressEnd);
  holdBtn?.addEventListener("pointercancel", pressEnd);
  holdBtn?.addEventListener("pointerleave", e => { if (state.rocket.holding) pressEnd(e); });
  $("#abort")?.addEventListener("click", () => rocketAbort("Abort pressed. Sensible. American."));

  // Museum
  $$(".exhibit").forEach(x => x.addEventListener("click", () => setPlaque(Number(x.getAttribute("data-exhibit")))));

  // Freedom meter
  $("#freedomClick")?.addEventListener("click", () => { addFreedom(8); audio.chirp(); bumpFreedomKpi(3); });
  $("#freedomMax")?.addEventListener("click", () => {
    state.freedom = 0; // reset so we can fill it dramatically
    const fill = () => { addFreedom(5); if (state.freedom < 100) setTimeout(fill, 60); };
    fill();
    fireworksBurst(state.eagleMode?10:6);
  });

  // Quotes
  $("#newQuote")?.addEventListener("click", () => { showQuote(); audio.chirp(); addFreedom(3); });
  $("#quoteFireworks")?.addEventListener("click", () => { fireworksBurst(state.eagleMode?8:5); launchConfetti(120); addFreedom(10); });

  // Facts
  $("#newFact")?.addEventListener("click", () => { showFact(); audio.chirp(); });
  $("#factCelebrate")?.addEventListener("click", () => { fireworksBurst(state.eagleMode?6:4); launchConfetti(80); addFreedom(8); });

  // Sound Board
  $("#soundEagle")?.addEventListener("click", () => { audio.eagle(); bumpEagleKpi(1); });
  $("#soundBoom")?.addEventListener("click", () => { audio.boom(); });
  $("#soundChirp")?.addEventListener("click", () => { audio.chirp(); });
  $("#soundAnthem")?.addEventListener("click", () => { audio.anthem(); bumpFreedomKpi(3); addFreedom(5); });

  // Eagle mode: periodic eagle fly-by
  setInterval(() => { if (state.eagleMode) flyEagle(); }, 8000);

  // Upgrade features
  $("#statesReset")?.addEventListener("click", () => {
    state.statesVisited = [];
    persist(); renderStates();
    audio.pop();
    showToast("🗺️ Tour reset.");
  });
  $("#petFeed")?.addEventListener("click", petFeed);
  $("#petPlay")?.addEventListener("click", petPlay);
  $("#petNap")?.addEventListener("click", petNap);
  $("#quizNext")?.addEventListener("click", quizNext);
  $("#quizRestart")?.addEventListener("click", startQuiz);
  $("#contestStart")?.addEventListener("click", contestStart);
  $("#contestDog")?.addEventListener("click", contestEat);
}

// --- persistence ---
const SAVE_KEY = "usa-hyperfreedom-v2";
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      freedom: state.freedom,
      stats: state.stats,
      statesVisited: state.statesVisited,
      achievements: state.achievements,
      pet: state.pet,
    }));
  } catch (e) {}
}
function restore() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (typeof d.freedom === "number") state.freedom = clamp(d.freedom, 0, 100);
    if (d.stats) state.stats = { ...state.stats, ...d.stats };
    if (Array.isArray(d.statesVisited)) state.statesVisited = d.statesVisited;
    if (d.achievements) state.achievements = d.achievements;
    if (d.pet) state.pet = { ...state.pet, ...d.pet };
  } catch (e) {}
}

// --- achievements ---
function showToast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("is-shown");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("is-shown"), 2600);
}
function unlock(id) {
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def || state.achievements[id]) return;
  state.achievements[id] = true;
  persist();
  showToast(`${def.icon} Achievement unlocked: ${def.name}`);
  audio.chirp();
  launchConfetti(60);
  renderAchievements();
}
function buildAchievements() {
  const grid = $("#achievementsGrid");
  if (!grid) return;
  grid.innerHTML = "";
  ACHIEVEMENTS.forEach(a => {
    const el = document.createElement("div");
    el.className = "ach";
    el.dataset.ach = a.id;
    el.innerHTML = `<div class="ach__icon" aria-hidden="true">${a.icon}</div>
      <div class="ach__name">${a.name}</div>
      <div class="ach__desc">${a.desc}</div>`;
    grid.appendChild(el);
  });
}
function renderAchievements() {
  const n = ACHIEVEMENTS.filter(a => state.achievements[a.id]).length;
  const meta = $("#achMeta");
  if (meta) meta.textContent = `${n} / ${ACHIEVEMENTS.length} unlocked`;
  $$(".ach").forEach(el => el.classList.toggle("is-unlocked", !!state.achievements[el.dataset.ach]));
}

// --- july 4th countdown ---
function updateCountdown() {
  const el = $("#july4Countdown");
  if (!el) return;
  const now = new Date();
  let target = new Date(now.getFullYear(), 6, 4);
  if (now > target) target = new Date(now.getFullYear() + 1, 6, 4);
  let s = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600);  s -= h * 3600;
  const m = Math.floor(s / 60);    s -= m * 60;
  el.textContent = `${d}d ${h}h ${m}m ${s}s`;
}

// --- 50 states ---
function buildStates() {
  const grid = $("#statesGrid");
  if (!grid) return;
  grid.innerHTML = "";
  STATES.forEach(st => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "state-chip" + (state.statesVisited.includes(st.abbr) ? " is-visited" : "");
    b.title = st.name;
    b.textContent = st.abbr;
    b.setAttribute("aria-label", `Visit ${st.name}`);
    b.addEventListener("click", () => visitState(st.abbr));
    grid.appendChild(b);
  });
}
function renderStates() {
  const label = $("#statesLabel"), fill = $("#statesFill");
  const n = state.statesVisited.length;
  if (label) label.textContent = `${n} / ${STATES.length} visited`;
  if (fill) fill.style.width = `${(n / STATES.length) * 100}%`;
  $$(".state-chip").forEach(b => b.classList.toggle("is-visited", state.statesVisited.includes(b.textContent)));
}
function visitState(abbr) {
  if (state.statesVisited.includes(abbr)) return;
  state.statesVisited.push(abbr);
  audio.pop();
  addFreedom(2);
  persist();
  renderStates();
  if (state.statesVisited.length === STATES.length) {
    unlock("all-states");
    fireworksBurst(state.eagleMode ? 10 : 6);
    launchConfetti(200);
    showToast("🏆 All 50 states! You ARE the map.");
  } else if (state.statesVisited.length % 10 === 0) {
    launchConfetti(50);
  }
}

// --- pet eagle ---
const petMsg = $("#petMsg");
function petBounce() {
  const el = $("#petEmoji");
  if (!el) return;
  el.classList.remove("bounce");
  void el.offsetWidth;
  el.classList.add("bounce");
}
function renderPet() {
  const p = state.pet;
  const h = $("#petHunger"), hp = $("#petHappy"), e = $("#petEnergy");
  if (h) h.style.width = `${p.hunger}%`;
  if (hp) hp.style.width = `${p.happy}%`;
  if (e) e.style.width = `${p.energy}%`;
  const el = $("#petEmoji"), status = $("#petStatus");
  const level = 1 + Math.floor(p.feeds / 5);
  if (el) {
    el.style.fontSize = `${52 + level * 7}px`;
    el.textContent = p.hunger < 30 ? "🥺" : p.happy < 30 ? "😾" : p.energy < 30 ? "😴" : "🦅";
  }
  if (status) {
    status.textContent = p.hunger < 30
      ? "Starving for freedom snacks"
      : p.happy < 30
        ? "In need of some play"
        : p.energy < 30
          ? "Taking a power nap"
          : `Majestic Level ${level}`;
  }
}
function petFeed() {
  state.pet.hunger = clamp(state.pet.hunger + 26, 0, 100);
  state.pet.happy = clamp(state.pet.happy + 4, 0, 100);
  state.pet.feeds += 1;
  audio.pop(); petBounce(); persist(); renderPet();
  if (petMsg) petMsg.textContent = rand([
    "Your eagle devours the snack.",
    "Snack acquired. Freedom metabolized.",
    "Yum. The eagle approves.",
    "Absolute unit of a snack.",
  ]);
  if (state.pet.feeds === 10) unlock("feed-10");
}
function petPlay() {
  if (state.pet.energy < 12) { if (petMsg) petMsg.textContent = "Too tired. The eagle demands a nap."; return; }
  state.pet.happy = clamp(state.pet.happy + 28, 0, 100);
  state.pet.energy = clamp(state.pet.energy - 14, 0, 100);
  audio.chirp(); petBounce(); persist(); renderPet();
  if (petMsg) petMsg.textContent = "Fetching a frisbee made of flags.";
}
function petNap() {
  state.pet.energy = clamp(state.pet.energy + 42, 0, 100);
  state.pet.happy = clamp(state.pet.happy + 6, 0, 100);
  audio.beep({ f: 330, t: 0.5, g: 0.07 });
  persist(); renderPet();
  if (petMsg) petMsg.textContent = "Zzz… majestic dreams.";
}
function petDecay() {
  state.pet.hunger = clamp(state.pet.hunger - 1, 0, 100);
  state.pet.happy = clamp(state.pet.happy - 1, 0, 100);
  state.pet.energy = clamp(state.pet.energy - 1, 0, 100);
  renderPet();
}

// --- quiz ---
let quiz = { idx: 0, score: 0, streak: 0, answered: false, done: false };
function renderQuizMeta() {
  const meta = $("#quizMeta");
  if (meta) meta.textContent = `Score: ${quiz.score} · Streak: ${quiz.streak}`;
}
function startQuiz() {
  quiz = { idx: 0, score: 0, streak: 0, answered: false, done: false };
  drawQuestion();
}
function drawQuestion() {
  renderQuizMeta();
  const box = $("#quizBox");
  if (!box) return;
  const q = QUIZ[quiz.idx];
  if (!q) { finishQuiz(); return; }
  box.innerHTML = "";
  const qEl = document.createElement("div");
  qEl.className = "quiz__question";
  qEl.textContent = q.q;
  box.appendChild(qEl);
  const opts = document.createElement("div");
  opts.className = "quiz__options";
  q.options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "quiz-opt"; b.textContent = opt;
    b.addEventListener("click", () => answerQuiz(i, q, b));
    opts.appendChild(b);
  });
  box.appendChild(opts);
}
function answerQuiz(i, q, btn) {
  if (quiz.answered) return;
  quiz.answered = true;
  $$(".quiz-opt").forEach(o => o.disabled = true);
  if (i === q.answer) {
    btn.classList.add("is-right");
    quiz.score += 1; quiz.streak += 1;
    addFreedom(5); audio.chirp();
  } else {
    $$(".quiz-opt")[q.answer].classList.add("is-right");
    btn.classList.add("is-wrong");
    quiz.streak = 0;
    audio.beep({ f: 170, t: 0.28, g: 0.12 });
  }
  renderQuizMeta();
}
function quizNext() {
  if (quiz.done) { startQuiz(); return; }
  if (!quiz.answered) { showToast("Pick an answer first!"); return; }
  quiz.idx += 1;
  quiz.answered = false;
  drawQuestion();
}
function finishQuiz() {
  const total = QUIZ.length;
  const pct = Math.round((quiz.score / total) * 100);
  if (quiz.score > state.stats.quizBest) { state.stats.quizBest = quiz.score; persist(); }
  const box = $("#quizBox");
  if (!box) return;
  box.innerHTML = `
    <div class="quiz__question">Final Score: ${quiz.score} / ${total}</div>
    <div class="quiz__result">${
      pct === 100 ? "Perfect. Absolutely constitutional. 🦅"
      : pct >= 70 ? "Solid patriotic performance. 🇺🇸"
      : pct >= 40 ? "Decent. The eagle is watching. 👀"
      : "The eagle is disappointed. Try again. 🥲"
    }</div>
  `;
  quiz.done = true;
  if (quiz.score === total) {
    unlock("quiz-perfect");
    launchConfetti(220);
    fireworksBurst(6);
  } else if (pct >= 70) {
    launchConfetti(80);
  }
}

// --- hot dog contest ---
let contest = { running: false, count: 0, raf: 0, start: 0 };
function contestStart() {
  if (contest.running) return;
  contest = { running: true, count: 0, raf: 0, start: performance.now() };
  const dog = $("#contestDog"), msg = $("#contestMsg"), startBtn = $("#contestStart");
  if (dog) dog.classList.add("is-running");
  if (msg) msg.textContent = "GO! Click the hot dog!";
  if (startBtn) startBtn.disabled = true;
  const countEl = $("#contestCount");
  if (countEl) countEl.textContent = "0";
  tickContest();
}
function tickContest() {
  if (!contest.running) return;
  const left = Math.max(0, 15 - (performance.now() - contest.start) / 1000);
  const timer = $("#contestTimer");
  if (timer) timer.textContent = `${left.toFixed(1)}s`;
  if (left <= 0) { contestEnd(); return; }
  contest.raf = requestAnimationFrame(tickContest);
}
function contestEat() {
  if (!contest.running) return;
  contest.count += 1;
  state.stats.hotDogs += 1;
  const countEl = $("#contestCount");
  if (countEl) countEl.textContent = String(contest.count);
  audio.pop();
  addFreedom(1);
  if (contest.count % 5 === 0) launchConfetti(18);
  persist();
}
function contestEnd() {
  contest.running = false;
  cancelAnimationFrame(contest.raf);
  const dog = $("#contestDog"), msg = $("#contestMsg"), startBtn = $("#contestStart");
  if (dog) dog.classList.remove("is-running");
  if (startBtn) startBtn.disabled = false;
  const timer = $("#contestTimer");
  if (timer) timer.textContent = "0.0s";
  const c = contest.count;
  if (c > state.stats.hotDogBest) { state.stats.hotDogBest = c; persist(); }
  const best = $("#contestBest");
  if (best) best.textContent = `Best: ${state.stats.hotDogBest}`;
  if (msg) msg.textContent = c >= 50
    ? `🌭 ${c} hot dogs! You are unstoppable.`
    : `Done! ${c} hot dogs demolished.`;
  if (c >= 50) {
    unlock("hotdog-50");
    launchConfetti(160);
    fireworksBurst(4);
  } else if (c >= 20) {
    launchConfetti(80);
  }
}

// --- live ticker ---
function refreshLiveTicker() {
  const map = {
    freedom: `FREEDOM: ${Math.round(state.freedom)}%`,
    states: `STATES: ${state.statesVisited.length}/${STATES.length}`,
    eagles: `EAGLE SCREAMS: ${eagleKpi ? eagleKpi.textContent : "0"}`,
    hotdogs: `HOT DOGS: ${state.stats.hotDogs}`,
  };
  $$("[data-live]").forEach(el => {
    const v = map[el.getAttribute("data-live")];
    if (v) el.textContent = v;
  });
}

// --- cursor sparkles ---
function initSparkles() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = $("#sparkle-layer");
  if (!layer) return;
  let last = 0;
  window.addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - last < 45) return;
    last = now;
    const s = document.createElement("span");
    s.className = "sparkle";
    s.textContent = rand(["✦", "★", "✧", "⋆", "·"]);
    s.style.left = e.clientX + "px";
    s.style.top = e.clientY + "px";
    s.style.color = rand(confettiColors);
    const dx = (Math.random() - 0.5) * 80;
    s.animate([
      { transform: "translate(-50%,-50%) translateY(0) scale(1)", opacity: 1 },
      { transform: `translate(-50%,-50%) translate(${dx}px,-52px) scale(.3)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 450, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    layer.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  });
}

// --- keyboard shortcuts ---
function initKeys() {
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
    switch (e.key.toLowerCase()) {
      case "f": fireworksBurst(6); addFreedom(2); break;
      case "c": launchConfetti(160); break;
      case "e": toggleEagleMode(); break;
      case "m": toggleMute(); break;
      case "g": $("#grandFinale")?.click(); break;
      case "q": $("#newQuote")?.click(); break;
    }
  });
}

function init() {
  restore();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  bindOath();
  bindUI();
  ensureFireworksLoop();
  showQuote();
  showFact();
  buildStates();
  renderStates();
  buildAchievements();
  renderAchievements();
  renderPet();
  startQuiz();
  updateCountdown();
  refreshLiveTicker();
  updateFreedomBar();
  setInterval(updateCountdown, 1000);
  setInterval(refreshLiveTicker, 2000);
  setInterval(petDecay, 3000);
  setInterval(persist, 5000);
  initSparkles();
  initKeys();

  // Ticker: ensure enough width
  const track = $("#tickerTrack");
  if (track) {
    const spans = Array.from(track.children);
    while (track.scrollWidth < window.innerWidth * 2.5) {
      spans.forEach(s => track.appendChild(s.cloneNode(true)));
    }
  }

  // Welcome burst
  setTimeout(() => { launchConfetti(90); fireworksBurst(3); }, 500);
  setTimeout(() => fireworksBurst(3), 1200);
}

init();
