/* Demo schedule, lots, and payments stand in for a database. */

const STORAGE_KEY = "orchard-reserve-bookings";
const OVERSIZE = 15;

const GAMES = [
  { id: "ne", opponent: "Patriots", full: "New England Patriots", date: "2026-10-11", time: "1:00 PM ET", prime: false },
  { id: "mia", opponent: "Dolphins", full: "Miami Dolphins", date: "2026-10-25", time: "1:00 PM ET", prime: false },
  { id: "nyj", opponent: "Jets", full: "New York Jets", date: "2026-11-08", time: "1:00 PM ET", prime: false },
  { id: "kc", opponent: "Chiefs", full: "Kansas City Chiefs", date: "2026-11-22", time: "8:20 PM ET", prime: true },
  { id: "pit", opponent: "Steelers", full: "Pittsburgh Steelers", date: "2026-12-13", time: "1:00 PM ET", prime: false },
  { id: "cle", opponent: "Browns", full: "Cleveland Browns", date: "2027-01-03", time: "1:00 PM ET", prime: false }
];

const LOTS = [
  { id: "premier", name: "Premier Gate", short: "Premier", walk: 2, walkLabel: "2 min walk", area: "Beside Gate 1", price: 95, spots: 11, perks: ["Paved", "Attendant"], tags: ["closest"], pin: { t: 32, l: 78 } },
  { id: "access", name: "Accessible Plaza", short: "Access", walk: 3, walkLabel: "3 min walk", area: "Accessible drop-off", price: 70, spots: 8, perks: ["ADA spaces", "Curb ramp"], tags: ["closest", "accessible"], pin: { t: 50, l: 74 } },
  { id: "north", name: "North End Zone", short: "North", walk: 6, walkLabel: "6 min walk", area: "North of the stadium", price: 70, spots: 48, perks: ["Paved", "Near restrooms"], tags: ["closest"], pin: { t: 14, l: 46 } },
  { id: "tailgate", name: "Tailgate Field", short: "Tailgate", walk: 8, walkLabel: "8 min walk", area: "Southwest lawn", price: 60, spots: 76, perks: ["Open grass", "Grills welcome"], tags: ["tailgate"], pin: { t: 38, l: 18 } },
  { id: "abbott", name: "Abbott Standard", short: "Abbott", walk: 12, walkLabel: "12 min walk", area: "Off Abbott Road", price: 45, spots: 110, perks: ["Paved", "Lower price"], tags: [], pin: { t: 70, l: 22 } },
  { id: "shuttle", name: "Southwestern Shuttle", short: "Shuttle", walk: 20, walkLabel: "4 min shuttle", area: "Southwestern Blvd", price: 32, spots: 150, perks: ["Shuttle included", "Easy exit"], tags: ["shuttle"], shuttle: true, pin: { t: 74, l: 58 } }
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "closest", label: "Closest" },
  { id: "tailgate", label: "Tailgate" },
  { id: "shuttle", label: "Shuttle" },
  { id: "accessible", label: "Accessible" }
];

const SEED = {
  id: "seed-mia",
  gameId: "mia",
  lotId: "tailgate",
  plate: "BUF-1842",
  vehicle: "car",
  total: 60,
  code: "HM-4D9K",
  space: "Row C · Space 22",
  created: Date.UTC(2026, 9, 1, 15, 0, 0)
};

const MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#C8102E"/><path fill="#fff" d="M10 8h7.2C21.5 8 24 10.3 24 13.5S21.5 19 17.2 19H13.2V24H10V8zm3.2 8h3.6c1.8 0 2.9-1 2.9-2.5S18.6 11 16.8 11H13.2V16z"/></svg>';

const state = {
  view: "login",
  locked: true,
  gameId: null,
  lotId: null,
  passId: null,
  filter: "all",
  vehicle: "car",
  plate: "BUF-1842",
  paying: false,
  reservations: []
};

let payToken = 0;
let bannerTimer = 0;

const RENDERS = {
  home: renderHome,
  lots: renderLots,
  checkout: renderCheckout,
  confirm: renderConfirm,
  passes: renderPasses,
  pass: renderPass,
  account: renderAccount
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function money(amount) {
  return `$${amount}`;
}

function uid() {
  return `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "HM-";
  for (let i = 0; i < 4; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function makeSpace() {
  const row = "ABCDEF"[Math.floor(Math.random() * 6)];
  const space = Math.floor(Math.random() * 40) + 1;
  return `Row ${row} · Space ${space}`;
}

function gameById(id) {
  return GAMES.find((game) => game.id === id) || null;
}

function lotById(id) {
  return LOTS.find((lot) => lot.id === id) || null;
}

function reservationById(id) {
  return state.reservations.find((item) => item.id === id) || null;
}

function parts(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return {
    dow: date.toLocaleDateString("en-US", { weekday: "long" }),
    month: date.toLocaleDateString("en-US", { month: "short" }),
    day: date.getDate(),
    long: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  };
}

function upcomingGames() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return GAMES.filter((game) => {
    const [year, month, day] = game.date.split("-").map(Number);
    return new Date(year, month - 1, day) >= start;
  });
}

function isPast(game) {
  const [year, month, day] = game.date.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59) < new Date();
}

function basePrice(game, lot) {
  return game.prime ? Math.round(lot.price * 1.2) : lot.price;
}

function totalPrice(game, lot, vehicle) {
  return basePrice(game, lot) + (vehicle === "oversize" ? OVERSIZE : 0);
}

function spotsLeft(game, lot) {
  const used = state.reservations.filter((item) => item.gameId === game.id && item.lotId === lot.id).length;
  return Math.max(0, lot.spots - used);
}

function openSpots(game) {
  return LOTS.reduce((sum, lot) => sum + spotsLeft(game, lot), 0);
}

function matches(lot, filter) {
  if (filter === "closest") return lot.walk <= 6 && !lot.shuttle;
  if (filter === "tailgate") return lot.tags.includes("tailgate");
  if (filter === "shuttle") return Boolean(lot.shuttle);
  if (filter === "accessible") return lot.tags.includes("accessible");
  return true;
}

function visibleLots() {
  return LOTS.filter((lot) => matches(lot, state.filter)).slice().sort((a, b) => a.walk - b.walk);
}

function liveReservations() {
  return state.reservations.filter((item) => item && item.id && gameById(item.gameId) && lotById(item.lotId));
}

function sortedReservations() {
  return liveReservations().slice().sort((a, b) => gameById(a.gameId).date.localeCompare(gameById(b.gameId).date));
}

function nextReservation() {
  const upcoming = new Set(upcomingGames().map((game) => game.id));
  return sortedReservations().find((item) => upcoming.has(item.gameId)) || null;
}

function hasPass(gameId) {
  return state.reservations.some((item) => item.gameId === gameId);
}

function bookedLot(gameId, lotId) {
  return state.reservations.some((item) => item.gameId === gameId && item.lotId === lotId);
}

function vehicleLabel(vehicle) {
  return vehicle === "oversize" ? "Oversized vehicle" : "Standard vehicle";
}

function stockOf(left, spots) {
  if (left <= 0) return "sold";
  if (spots > 0 && left / spots <= 0.25) return "low";
  return "ok";
}

function stockText(left) {
  if (left <= 0) return "Sold out";
  if (left <= 12) return `Only ${left} left`;
  return `${left} open`;
}

function delay(index) {
  return `style="--d:${(index * 0.04).toFixed(2)}s"`;
}

function finderOn(row, col, size) {
  const boxes = [[0, 0], [0, size - 5], [size - 5, 0]];
  for (let i = 0; i < boxes.length; i += 1) {
    const row0 = boxes[i][0];
    const col0 = boxes[i][1];
    if (row < row0 || col < col0 || row >= row0 + 5 || col >= col0 + 5) continue;
    const localRow = row - row0;
    const localCol = col - col0;
    const border = localRow === 0 || localCol === 0 || localRow === 4 || localCol === 4;
    const center = localRow === 2 && localCol === 2;
    return border || center;
  }
  return null;
}

function qrMarkup(seed) {
  const size = 13;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const cells = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      hash = Math.imul(hash ^ (row * 31 + col), 16777619);
      const mark = finderOn(row, col, size);
      const on = mark === null ? (hash & 1) === 1 : mark;
      cells.push(`<i class="${on ? "on" : ""}"></i>`);
    }
  }
  return `<div class="qr" aria-hidden="true">${cells.join("")}</div>`;
}

function loadReservations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.reservations = [SEED];
      saveReservations();
      return;
    }
    const parsed = JSON.parse(raw);
    state.reservations = Array.isArray(parsed) ? parsed : [SEED];
  } catch (err) {
    state.reservations = [SEED];
  }
}

function saveReservations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reservations));
  } catch (err) {
    /* This browser blocked storage. The pass still shows for this visit. */
  }
}

function snapshot() {
  return {
    view: state.view,
    gameId: state.gameId,
    lotId: state.lotId,
    passId: state.passId
  };
}

function flash(message) {
  const banner = document.getElementById("banner");
  banner.textContent = message;
  banner.classList.remove("hidden");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.add("hidden"), 3400);
}

function closeDialog() {
  const dialog = document.getElementById("dialog");
  dialog.classList.add("hidden");
  dialog.setAttribute("aria-hidden", "true");
  document.getElementById("app").inert = false;
  document.body.classList.remove("is-modal");
}

function openDialog() {
  const dialog = document.getElementById("dialog");
  dialog.classList.remove("hidden");
  dialog.setAttribute("aria-hidden", "false");
  document.getElementById("app").inert = true;
  document.body.classList.add("is-modal");
  document.getElementById("keepBtn").focus();
}

function syncChrome() {
  const inApp = state.view !== "login";
  document.body.classList.toggle("is-login", !inApp);
  document.body.dataset.view = state.view;
  document.getElementById("login").classList.toggle("hidden", inApp);
  document.getElementById("app").classList.toggle("hidden", !inApp);
  document.getElementById("back").classList.toggle("hidden", !["lots", "checkout", "pass"].includes(state.view));
  const tab = state.view === "pass" ? "passes" : state.view;
  document.querySelectorAll('[data-action="nav"]').forEach((el) => {
    const on = el.dataset.view === tab;
    el.classList.toggle("is-on", on);
    if (on) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  const badge = document.getElementById("passCount");
  const count = liveReservations().length;
  badge.textContent = String(count);
  badge.classList.toggle("hidden", count < 1);
}

function syncPaybar() {
  const bar = document.getElementById("paybar");
  const game = gameById(state.gameId);
  const lot = lotById(state.lotId);
  if (state.view !== "checkout" || !game || !lot) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }
  const total = totalPrice(game, lot, state.vehicle);
  bar.classList.remove("hidden");
  bar.innerHTML = `
    <div class="paybar-total"><span>Total</span><strong>${money(total)}</strong></div>
    <button class="btn primary" type="submit" form="payForm" data-pay="1">Pay now</button>
  `;
}

function refreshUI(animate) {
  syncChrome();
  const main = document.getElementById("main");
  if (state.view === "login") {
    main.innerHTML = "";
    main.classList.remove("is-enter");
    document.getElementById("paybar").classList.add("hidden");
    document.title = "Log in · Orchard Reserve";
    if (animate) document.getElementById("status").textContent = "Log in";
    document.getElementById("enterBtn").focus({ preventScroll: true });
    return;
  }
  const render = RENDERS[state.view] || renderMissing;
  main.innerHTML = render();
  main.classList.remove("is-enter");
  if (animate) {
    void main.offsetWidth;
    main.classList.add("is-enter");
  }
  syncPaybar();
  const heading = document.getElementById("view-title");
  if (heading) {
    document.title = `${heading.dataset.title || heading.textContent} · Orchard Reserve`;
    if (animate) {
      document.getElementById("status").textContent = heading.dataset.title || heading.textContent;
      heading.focus({ preventScroll: true });
    }
  }
  if (animate) window.scrollTo(0, 0);
}

function go(view, extra, opts) {
  if (!opts || !opts.keepPay) {
    payToken += 1;
    state.paying = false;
  }
  if (extra) Object.assign(state, extra);
  state.view = view;
  state.locked = view === "login";
  const url = view === "login" ? `${location.pathname}${location.search}` : `#${view}`;
  history.pushState(snapshot(), "", url);
  refreshUI(view !== "login");
  window.scrollTo(0, 0);
}

function renderHome() {
  const games = upcomingGames();
  if (!games.length) {
    return `
      <section>
        <h1 id="view-title" data-title="Home">Home slate wrapped</h1>
        <p class="lede">The sample home games in this demo are in the past.</p>
      </section>`;
  }
  const [next, ...rest] = games;
  const when = parts(next.date);
  const pass = nextReservation();
  const side = pass ? sidePass(pass) : sideLots(next);
  const cards = rest.map((game, index) => gameCard(game, index)).join("");
  return `
    <section class="hero-grid">
      <article class="hero rise">
        <p class="eyebrow">Next home game</p>
        <p class="hero-when">${esc(when.long)} · ${esc(next.time)}</p>
        <h1 class="matchup" id="view-title" data-title="Home" tabindex="-1"><small>Bills vs</small>${esc(next.opponent)}</h1>
        <p class="hero-place">Highmark Stadium · Orchard Park</p>
        ${next.prime ? '<div class="hero-actions" style="margin-top:12px"><span class="pill">Prime time</span></div>' : ""}
        <div class="hero-actions">
          <button class="btn primary" type="button" data-action="open-game" data-id="${esc(next.id)}">Reserve parking</button>
          <p class="hero-spots">${openSpots(next)} spots open across ${LOTS.length} lots</p>
        </div>
      </article>
      ${side}
    </section>
    <ol class="steps">
      <li class="rise" style="--d:.08s"><span>01</span><h2>Pick a game</h2><p>Choose a Buffalo Bills home date at Highmark Stadium.</p></li>
      <li class="rise" style="--d:.12s"><span>02</span><h2>Choose a lot</h2><p>Walk up, tailgate, ride the shuttle, or take an accessible space.</p></li>
      <li class="rise" style="--d:.16s"><span>03</span><h2>Show your pass</h2><p>Pay in the browser, then open the pass at the lot entrance.</p></li>
    </ol>
    ${cards ? `<h2 class="section-title">Home slate</h2><div class="game-grid">${cards}</div>` : ""}
    <footer class="site-foot">
      <p>Orchard Reserve is a demo desk for game-day parking near Highmark Stadium, One Bills Drive, Orchard Park, NY.</p>
      <p>Sample games, lots, and payments stay in this browser.</p>
    </footer>
  `;
}

function sidePass(rec) {
  const game = gameById(rec.gameId);
  const lot = lotById(rec.lotId);
  const when = parts(game.date);
  return `
    <aside class="side rise" style="--d:.06s">
      <p class="eyebrow">Your next pass</p>
      <h2>Bills vs ${esc(game.opponent)}</h2>
      <p>${esc(when.dow)}, ${esc(when.month)} ${when.day} · ${esc(lot.name)}</p>
      <p class="side-code">${esc(rec.code)}</p>
      <button class="btn primary" type="button" data-action="open-pass" data-id="${esc(rec.id)}">Open pass</button>
    </aside>`;
}

function sideLots(game) {
  const prices = LOTS.map((lot) => basePrice(game, lot));
  const low = Math.min(...prices);
  return `
    <aside class="side rise" style="--d:.06s">
      <p class="eyebrow">Lots</p>
      <h2>From ${money(low)}</h2>
      <p>Six options, from a gate-side spot to a shuttle lot on Southwestern Blvd.</p>
      <button class="btn primary" type="button" data-action="open-game" data-id="${esc(game.id)}">See lots</button>
    </aside>`;
}

function gameCard(game, index) {
  const when = parts(game.date);
  const low = Math.min(...LOTS.map((lot) => basePrice(game, lot)));
  return `
    <button class="game-card rise" type="button" data-action="open-game" data-id="${esc(game.id)}" ${delay(index)}>
      <span class="date-block"><small>${esc(when.month)}</small><strong>${when.day}</strong></span>
      <span class="game-copy">
        <span class="game-kicker">${esc(when.dow)} · ${esc(game.time)}</span>
        <span class="game-name">Bills vs ${esc(game.opponent)}</span>
        <span class="game-sub">From ${money(low)}${game.prime ? " · Prime time" : ""}${hasPass(game.id) ? " · Pass ready" : ""}</span>
      </span>
      <span class="game-go">Reserve</span>
    </button>`;
}

function renderLots() {
  const games = upcomingGames();
  const game = gameById(state.gameId) || games[0];
  if (!game) return renderHome();
  state.gameId = game.id;
  const lots = visibleLots();
  const options = games.map((item) => {
    const when = parts(item.date);
    const selected = item.id === game.id ? "selected" : "";
    return `<option value="${esc(item.id)}" ${selected}>${esc(when.month)} ${when.day} · Bills vs ${esc(item.opponent)}</option>`;
  }).join("");
  const chips = FILTERS.map((filter) => {
    const on = state.filter === filter.id;
    return `<button class="chip${on ? " is-on" : ""}" type="button" aria-pressed="${on}" data-action="filter" data-filter="${filter.id}">${filter.label}</button>`;
  }).join("");
  const cards = lots.map((lot, index) => lotCard(game, lot, index)).join("");
  return `
    <section>
      <div class="page-head">
        <div>
          <p class="eyebrow">Highmark Stadium</p>
          <h1 id="view-title" data-title="Choose a lot" tabindex="-1">Choose a lot</h1>
        </div>
        <label class="switcher">
          <span>Game</span>
          <select id="gameSelect">${options}</select>
        </label>
      </div>
      ${game.prime ? '<p class="note">Prime time game. Lot prices are higher for this kickoff.</p>' : ""}
      <div class="lots-layout">
        <div class="map-wrap">
          <div class="map" aria-hidden="true">
            <span class="compass">N</span>
            <div class="stadium"><span>STADIUM</span></div>
            <div class="road"></div>
            ${LOTS.map((lot) => pinMarkup(game, lot)).join("")}
          </div>
          <p class="map-caption">Around Highmark Stadium · Orchard Park</p>
        </div>
        <div>
          <div class="chips" role="group" aria-label="Filter lots">${chips}</div>
          <div class="lot-list">
            ${cards || '<p class="empty-inline">Nothing in this group. Try another filter.</p>'}
          </div>
        </div>
      </div>
    </section>`;
}

function pinMarkup(game, lot) {
  const left = spotsLeft(game, lot);
  const stock = stockOf(left, lot.spots);
  const yours = bookedLot(game.id, lot.id) ? " yours" : "";
  const dim = matches(lot, state.filter) ? "" : " dim";
  const hot = left > 0 && left <= 12 ? " hot" : "";
  const price = left > 0 ? money(basePrice(game, lot)) : "Full";
  return `
    <button class="pin ${stock}${hot}${yours}${dim}" type="button" style="top:${lot.pin.t}%;left:${lot.pin.l}%" data-action="open-lot" data-id="${esc(lot.id)}" ${left < 1 ? "disabled" : ""}>
      <b></b>
      <span>${esc(lot.short)}<small>${price}</small></span>
    </button>`;
}

function lotCard(game, lot, index) {
  const left = spotsLeft(game, lot);
  const stock = stockOf(left, lot.spots);
  const label = left > 0 && left <= 12 ? "low" : stock;
  const pct = left <= 0 ? 0 : Math.max(8, Math.min(100, Math.round((left / 80) * 100)));
  const perks = lot.perks.slice(0, 3).map((perk) => `<span>${esc(perk)}</span>`).join("");
  const owned = bookedLot(game.id, lot.id) ? "<span>Pass on file</span>" : "";
  return `
    <button class="lot-card rise" type="button" data-action="open-lot" data-id="${esc(lot.id)}" ${delay(index)} ${left < 1 ? "disabled" : ""}>
      <span class="lot-top">
        <span class="lot-name">${esc(lot.name)}</span>
        <span class="price">${money(basePrice(game, lot))}</span>
      </span>
      <span class="lot-meta">${esc(lot.walkLabel)} · ${esc(lot.area)}</span>
      <span class="meter ${label}"><span style="--w:${pct}%"></span></span>
      <span class="stock ${label}">${stockText(left)}</span>
      <span class="perks">${perks}${owned}</span>
      <span class="reserve-label">${left < 1 ? "Sold out" : "Reserve"}</span>
    </button>`;
}

function renderCheckout() {
  const game = gameById(state.gameId);
  const lot = lotById(state.lotId);
  if (!game || !lot) {
    return `
      <section class="narrow">
        <h1 id="view-title" data-title="Checkout" tabindex="-1">Checkout</h1>
        <p class="lede">Choose a lot before paying.</p>
        <button class="btn primary" type="button" data-action="nav" data-view="lots">See lots</button>
      </section>`;
  }
  const when = parts(game.date);
  const prices = {
    base: basePrice(game, lot),
    extra: state.vehicle === "oversize" ? OVERSIZE : 0
  };
  prices.total = prices.base + prices.extra;
  const extraRow = prices.extra
    ? `<div><span>Oversized vehicle</span><span>${money(prices.extra)}</span></div>`
    : "";
  const shuttle = lot.shuttle ? '<p class="note">Shuttle rides are included with this pass.</p>' : "";
  const access = lot.tags.includes("accessible") ? '<p class="note">Accessible spaces and a curb ramp are in this lot.</p>' : "";
  return `
    <section class="checkout-grid">
      <div>
        <p class="eyebrow">One vehicle per pass</p>
        <h1 id="view-title" data-title="Checkout" tabindex="-1">Checkout</h1>
        <div class="recap">
          <div><span>Game</span><strong>${esc(when.dow)}, ${esc(when.month)} ${when.day} · Bills vs ${esc(game.opponent)}</strong></div>
          <div><span>Lot</span><strong>${esc(lot.name)} · ${esc(lot.walkLabel)}</strong></div>
        </div>
        ${shuttle}
        ${access}
        <div class="seg" role="group" aria-label="Vehicle size">
          <button type="button" class="${state.vehicle === "car" ? "is-on" : ""}" aria-pressed="${state.vehicle === "car"}" data-action="vehicle" data-vehicle="car">Standard</button>
          <button type="button" class="${state.vehicle === "oversize" ? "is-on" : ""}" aria-pressed="${state.vehicle === "oversize"}" data-action="vehicle" data-vehicle="oversize">Oversized +${money(OVERSIZE)}</button>
        </div>
        <div class="field">
          <label for="plate">License plate</label>
          <input id="plate" maxlength="10" value="${esc(state.plate)}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <form id="payForm" class="summary">
        <div class="card-visual" aria-label="Saved card ending in 4242">
          <div class="card-top"><span class="emv" aria-hidden="true"></span><span>Saved</span></div>
          <p class="card-num">**** **** **** 4242</p>
          <div class="card-bot"><span>Casey Lang</span><span>**/**</span><span>***</span></div>
        </div>
        <div class="rows">
          <div><span>${esc(lot.name)}</span><span>${money(prices.base)}</span></div>
          ${extraRow}
          <div class="total"><span>Total</span><strong>${money(prices.total)}</strong></div>
        </div>
        <p class="fine">Demo checkout. No charge is placed. Price is for one vehicle.</p>
        <button id="payBtn" class="btn primary pay-inline" type="submit" data-pay="1">Pay now</button>
      </form>
    </section>`;
}

function passCard(rec) {
  const game = gameById(rec.gameId);
  const lot = lotById(rec.lotId);
  const when = parts(game.date);
  return `
    <article class="pass">
      <header class="pass-head">
        ${MARK}
        <span>Orchard Reserve</span>
        <span class="pass-code">${esc(rec.code)}</span>
      </header>
      <div class="pass-body">
        <p class="eyebrow">Buffalo Bills home game</p>
        <h2>Bills vs ${esc(game.opponent)}</h2>
        <p class="pass-when">${esc(when.long)} · ${esc(game.time)}</p>
        <div class="split">
          <div class="pass-fields">
            <p><span>Lot</span><strong>${esc(lot.name)}</strong></p>
            <p><span>Space</span><strong>${esc(rec.space)}</strong></p>
            <p><span>Plate</span><strong>${esc(rec.plate)}</strong></p>
            <p><span>Vehicle</span><strong>${esc(vehicleLabel(rec.vehicle))}</strong></p>
          </div>
          ${qrMarkup(rec.code)}
        </div>
        <p class="pass-foot">Highmark Stadium · One Bills Drive, Orchard Park</p>
        <p class="pass-note">Show this pass at the lot entrance. Gates open about three hours before kickoff.</p>
      </div>
    </article>`;
}

function renderConfirm() {
  const rec = reservationById(state.passId);
  if (!rec || !gameById(rec.gameId)) {
    return `
      <section class="narrow">
        <h1 id="view-title" data-title="Parking reserved" tabindex="-1">Pass not found</h1>
        <button class="btn primary" type="button" data-action="nav" data-view="passes">See passes</button>
      </section>`;
  }
  return `
    <section class="confirm">
      <div class="check rise" aria-hidden="true"><span></span></div>
      <h1 id="view-title" data-title="Parking reserved" tabindex="-1">Parking reserved</h1>
      <p class="lede">Show this pass at the lot entrance.</p>
      ${passCard(rec)}
      <div class="action-row">
        <button class="btn primary" type="button" data-action="nav" data-view="passes">Done</button>
        <button class="btn ghost" type="button" data-action="nav" data-view="home">Book another</button>
      </div>
    </section>`;
}

function renderPasses() {
  const items = sortedReservations();
  const list = items.map((rec, index) => {
    const game = gameById(rec.gameId);
    const lot = lotById(rec.lotId);
    const when = parts(game.date);
    return `
      <button class="pass-row rise" type="button" data-action="open-pass" data-id="${esc(rec.id)}" ${delay(index)}>
        <span class="date-block"><small>${esc(when.month)}</small><strong>${when.day}</strong></span>
        <span class="pass-copy">
          <span class="pass-game">Bills vs ${esc(game.opponent)}</span>
          <span class="pass-meta">${esc(lot.name)} · ${esc(rec.space)}</span>
        </span>
        <span class="pass-price">${money(rec.total)}</span>
      </button>`;
  }).join("");
  return `
    <section>
      <h1 id="view-title" data-title="Your passes" tabindex="-1">Your passes</h1>
      <p class="lede">${items.length ? "Open a pass when you reach the lot." : "Reserved spots show up here."}</p>
      ${list ? `<div class="pass-list">${list}</div>` : '<div class="empty"><p>No passes yet.</p><button class="btn primary" type="button" data-action="nav" data-view="home">See home games</button></div>'}
    </section>`;
}

function renderPass() {
  const rec = reservationById(state.passId);
  if (!rec || !gameById(rec.gameId) || !lotById(rec.lotId)) {
    return `
      <section class="narrow">
        <h1 id="view-title" data-title="Pass" tabindex="-1">Pass not found</h1>
        <button class="btn primary" type="button" data-action="nav" data-view="passes">Back to passes</button>
      </section>`;
  }
  const game = gameById(rec.gameId);
  const cancel = isPast(game)
    ? ""
    : '<button class="btn danger" type="button" data-action="ask-cancel">Cancel reservation</button>';
  return `
    <section class="confirm">
      <h1 id="view-title" data-title="Pass" tabindex="-1">Your pass</h1>
      <p class="lede">${esc(rec.code)} · ${money(rec.total)}</p>
      ${passCard(rec)}
      <div class="action-row">${cancel}</div>
    </section>`;
}

function renderAccount() {
  const count = liveReservations().length;
  return `
    <section class="narrow">
      <h1 id="view-title" data-title="Account" tabindex="-1">Account</h1>
      <div class="profile rise">
        <div class="avatar" aria-hidden="true">CL</div>
        <div>
          <p class="profile-name">Casey Lang</p>
          <p class="muted">Orchard Park</p>
        </div>
      </div>
      <dl class="facts-list">
        <div><dt>Member ID</dt><dd>••••1842</dd></div>
        <div><dt>Passes on this device</dt><dd>${count}</dd></div>
      </dl>
      <p class="fine">Reservations stay in this browser. Signing out keeps them here for next time.</p>
      <div class="action-row">
        <button class="btn ghost" type="button" data-action="sign-out">Sign out</button>
      </div>
    </section>`;
}

function renderMissing() {
  return `
    <section class="narrow">
      <h1 id="view-title" data-title="Home" tabindex="-1">That screen is not here</h1>
      <button class="btn primary" type="button" data-action="nav" data-view="home">Go home</button>
    </section>`;
}

async function submitPayment() {
  if (state.paying) return;
  const game = gameById(state.gameId);
  const lot = lotById(state.lotId);
  if (!game || !lot) return;
  if (spotsLeft(game, lot) < 1) {
    flash("That lot just filled. Pick another.");
    go("lots");
    return;
  }
  state.paying = true;
  const token = ++payToken;
  document.querySelectorAll("[data-pay]").forEach((btn) => {
    btn.disabled = true;
    btn.textContent = "Processing…";
  });
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (token !== payToken) return;
  const plate = (state.plate || "").trim().toUpperCase() || "NOT SET";
  const rec = {
    id: uid(),
    gameId: game.id,
    lotId: lot.id,
    plate,
    vehicle: state.vehicle,
    total: totalPrice(game, lot, state.vehicle),
    code: makeCode(),
    space: makeSpace(),
    created: Date.now()
  };
  state.reservations.push(rec);
  saveReservations();
  state.paying = false;
  state.passId = rec.id;
  go("confirm", null, { keepPay: true });
}

function onClick(event) {
  const el = event.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  if (action === "back") {
    history.back();
    return;
  }
  if (action === "nav") {
    if (state.view === el.dataset.view) return;
    go(el.dataset.view);
    return;
  }
  if (action === "open-game") {
    go("lots", { gameId: el.dataset.id, filter: "all" });
    return;
  }
  if (action === "open-lot") {
    const game = gameById(state.gameId);
    const lot = lotById(el.dataset.id);
    if (!game || !lot) return;
    if (spotsLeft(game, lot) < 1) {
      flash("That lot is full.");
      return;
    }
    go("checkout", { lotId: lot.id });
    return;
  }
  if (action === "filter") {
    state.filter = el.dataset.filter;
    refreshUI(false);
    return;
  }
  if (action === "vehicle") {
    state.vehicle = el.dataset.vehicle === "oversize" ? "oversize" : "car";
    refreshUI(false);
    return;
  }
  if (action === "open-pass") {
    go("pass", { passId: el.dataset.id });
    return;
  }
  if (action === "ask-cancel") {
    openDialog();
    return;
  }
  if (action === "close-dialog") {
    closeDialog();
    return;
  }
  if (action === "confirm-cancel") {
    state.reservations = state.reservations.filter((item) => item.id !== state.passId);
    saveReservations();
    closeDialog();
    flash("Reservation released.");
    go("passes");
    return;
  }
  if (action === "sign-out") go("login");
}

function bind() {
  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    go("home");
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id !== "payForm") return;
    event.preventDefault();
    submitPayment();
  });
  document.addEventListener("click", onClick);
  document.addEventListener("input", (event) => {
    if (event.target.id !== "plate") return;
    state.plate = event.target.value.slice(0, 10);
  });
  document.addEventListener("change", (event) => {
    if (event.target.id !== "gameSelect") return;
    state.gameId = event.target.value;
    state.lotId = null;
    history.replaceState(snapshot(), "", "#lots");
    refreshUI(false);
  });
  document.getElementById("dialog").addEventListener("click", (event) => {
    if (event.target.id === "dialog") closeDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDialog();
  });
  window.addEventListener("popstate", (event) => {
    payToken += 1;
    state.paying = false;
    closeDialog();
    if (state.locked) {
      state.view = "login";
      history.replaceState(snapshot(), "", `${location.pathname}${location.search}`);
      refreshUI(false);
      return;
    }
    const next = event.state || { view: "login" };
    state.view = next.view || "login";
    state.gameId = next.gameId || null;
    state.lotId = next.lotId || null;
    state.passId = next.passId || null;
    state.locked = state.view === "login";
    refreshUI(state.view !== "login");
    window.scrollTo(0, 0);
  });
}

function init() {
  loadReservations();
  history.replaceState(snapshot(), "", `${location.pathname}${location.search}`);
  bind();
  refreshUI(false);
}

init();
