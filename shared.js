/*
  Shared helpers for the NYC skatepark directory.

  Loaded by both the homepage (index.html) and the reusable detail
  template (detail.html), so the URL for a skatepark and the fields
  shown for it are decided in exactly one place.
*/

const siteConfig = {
  siteName: "NYC Skateparks",
  kicker: "Independent directory",
  title: "New York City skateparks.",
  description:
    "A directory of skateparks, skate plazas and skate spots across the five boroughs.",
  dataUrl: "/data/skateparks.json"
};

/* Where a reusable detail template lives. One file answers every park:
   with a server rewrite it is /skateparks/<slug>, and detail.html is the
   file it serves. */
const PARK_PATH = "/skateparks/";

/* ---------- text ---------- */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  const safeValue = String(value);

  if (
    safeValue.startsWith("/") ||
    safeValue.startsWith("#") ||
    safeValue.startsWith("https://")
  ) {
    return escapeHtml(safeValue);
  }

  return "#";
}

// A value is present only when it actually holds something.
function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed !== "" && !/^(not found|n\/a|unknown|none)$/i.test(trimmed);
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

const clean = value => String(value).trim();

// Some records hold prose written for the reader, e.g. "... | Not found".
// Keep the sentence, drop the placeholder.
function dropPlaceholders(value) {
  return clean(String(value).replace(/\s*\|\s*Not found\.?/gi, "."));
}

// A boolean field may be a real boolean or "true"/"false"/"see notes".
function flagText(value, label) {
  if (value === true || /^true$/i.test(clean(value))) return label;
  if (value === false || /^false$/i.test(clean(value))) return `No ${label.toLowerCase()}`;
  return clean(value);
}

function list(items) {
  const present = items.filter(hasValue).map(clean);
  if (present.length <= 1) return present[0] || "";
  return `${present.slice(0, -1).join(", ")} and ${present[present.length - 1]}`;
}

/* Fields that hold a free-text sentence. Used to build the meta
   description from the record itself rather than from invented copy. */
/* A leading chunk that is only a status word ("Partial.", "Limited.") is
   not a usable sentence start. */
const STATUS_FRAGMENT = /^(partial|limited|minimal|none|not found|unknown|unclear|unspecified|mixed)\.\s+/i;

/* "Robert E." and "Sgt." end with a period but do not end a sentence. */
const ABBREVIATION = /(?:\b[A-Z]|\b(?:mr|mrs|ms|dr|rev|sgt|st|jr|sr|vs|etc|ave|blvd|rd|no|approx|est|dept|inc|ltd))\.$/i;

/* Pull a standalone sentence out of a free-text field. Chunks that are
   abbreviation artifacts or status labels are merged rather than sliced. */
function firstSentence(value, max = 170, min = 40) {
  if (!hasValue(value)) return "";

  const text = dropPlaceholders(value).replace(/\s+/g, " ");
  const chunks = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [text];

  let sentence = "";
  for (const chunk of chunks) {
    sentence += chunk;

    const endsCleanly =
      /[.!?]$/.test(chunk.trim()) && !ABBREVIATION.test(chunk.trim());

    if (endsCleanly && sentence.trim().length >= min) break;
    if (sentence.length >= max) break;
  }

  let result = sentence.trim().replace(STATUS_FRAGMENT, "").trim();
  if (!result) result = sentence.trim();

  if (result.length <= max) return result;
  return `${result.slice(0, max).replace(/[\s,;:.-]+$/, "")}…`;
}

/* ---------- names, URLs, fields ---------- */

// Notes written into the name for the research file are not part of the
// name: "(official NYC Parks property name is ...)", "(dataset label is
// wrong ...)", "(locally known as ...)" and so on.
const EDITORIAL_NOTE = /\b(official|dataset|label|locally|property|formerly|wrong|not a state|also listed)\b/i;

function displayName(name) {
  return clean(
    String(name).replace(/\s*\(([^()]*)\)/g, (match, inner) =>
      EDITORIAL_NOTE.test(inner) ? "" : match
    )
  );
}

// Parentheticals kept in the display name, surfaced as-is (e.g. "(Rudd Skatepark)").
function nameNotes(name, finalName) {
  const notes = [];
  const pattern = /\(([^()]*)\)/g;
  let match;

  while ((match = pattern.exec(String(name))) !== null) {
    const inner = match[1].trim();
    if (inner && !finalName.includes(match[0])) notes.push(inner);
  }

  return notes;
}

// ASCII, lowercase, hyphenated: /skateparks/central-park-skatepark
function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parkSlug(park) {
  return slugify(park.park_name);
}

function parkPath(park) {
  return `${PARK_PATH}${parkSlug(park)}`;
}

/* Every skatepark lives at /skateparks/<slug>. Assets and the data file
   use root-absolute paths so this works under that URL. */
function parkHref(park) {
  return parkPath(park);
}

/* ---------- record shaping ---------- */

/* The source data often copies the same paragraph into several fields
   (vibe, local_scene, safety_notes, cultural_significance ...), and a few
   fields are near-identical. Rendering each one repeats whole sentences,
   so values are compared as normalised text and repeats are dropped. */
function normaliseText(value) {
  return dropPlaceholders(String(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* Short values still repeat (aka vs skater_nickname often hold the same
   alias), so exact matches are caught at any length; the fuzzy
   "one contains the other" rule needs enough text to be meaningful. */
const DEDUPE_MIN = 25;

function createDeduper() {
  const kept = [];

  return function isDuplicate(value) {
    const current = normaliseText(value);
    if (current.length < 2) return false;

    for (const previous of kept) {
      if (previous === current) return true;

      if (current.length < DEDUPE_MIN || previous.length < DEDUPE_MIN) continue;

      const shorter = Math.min(previous.length, current.length);
      const longer = Math.max(previous.length, current.length);

      // One value is essentially the other (a superset, or the same
      // paragraph with a different lead-in).
      if (shorter / longer >= 0.6 && (previous.includes(current) || current.includes(previous))) {
        return true;
      }
    }

    kept.push(current);
    return false;
  };
}

/* Which field the hero lede was taken from, so it is not repeated below. */
const SUMMARY_FIELDS = ["distinctive_finding", "obstacle_inventory", "origin_story", "description_short", "surface_condition_detail", "current_condition"];

function parkSummaryField(park) {
  return SUMMARY_FIELDS.find(key => hasValue(park[key])) || "";
}

function parkSummary(park) {
  const field = parkSummaryField(park);
  return field ? firstSentence(park[field], 220) : "";
}

function parkTitle(park) {
  const name = displayName(park.park_name);
  const borough = hasValue(park.borough_name) ? clean(park.borough_name) : "";
  return borough ? `${name}, ${borough} — ${siteConfig.siteName}` : `${name} — ${siteConfig.siteName}`;
}

function parkLocation(park) {
  const parts = list([park.neighborhood, park.borough_name]);
  return parts || "New York City";
}

/* Breadcrumb trail that also carries schema.org markup. */
function parkBreadcrumb(park, origin = "") {
  const name = displayName(park.park_name);

  return {
    html: `
      <ol class="breadcrumb-list">
        <li><a href="/">Directory</a></li>
        <li><a href="/#directory">Skateparks</a></li>
        <li aria-current="page">${escapeHtml(name)}</li>
      </ol>
    `,
    json: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Directory", item: `${origin}/` },
        { "@type": "ListItem", position: 2, name: "Skateparks", item: `${origin}/#directory` },
        { "@type": "ListItem", position: 3, name, item: `${origin}${parkPath(park)}` }
      ]
    }
  };
}

function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
}

// name = "description"/"robots", or property = "og:title"/"og:url".
function setMetaTag({ name, property }, content) {
  const selector = name
    ? `meta[name="${name}"]`
    : `meta[property="${property}"]`;

  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");

    if (name) element.setAttribute("name", name);
    if (property) element.setAttribute("property", property);

    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setJsonLd(id, data) {
  let script = document.querySelector(`script#${id}`);

  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

/* Records with no narrative field still get a description built only from
   values the record actually holds. */
function terrainPhrase(park) {
  return list([
    park.has_flatground === true ? "flat ground" : "",
    park.has_ledges === true ? "ledges" : "",
    park.has_rails === true ? "rails" : "",
    park.has_stairs === true ? "stairs" : "",
    park.has_bowl_transition === true ? "transition" : ""
  ]);
}

function composedDescription(park) {
  const type = hasValue(park.skatepark_type) ? clean(park.skatepark_type) : "skatepark";
  const surface = hasValue(park.surface) ? clean(park.surface).toLowerCase() : "";
  const terrain = terrainPhrase(park);
  const size = hasValue(park.footprint_size) ? clean(park.footprint_size) : "";

  const noun = `${surface} ${type}`.trim();
  const article = /^[aeiou]/i.test(noun) ? "An" : "A";
  const base = `${article} ${noun} in ${parkLocation(park)}${terrain ? ` with ${terrain}` : ""}.`;

  return size ? `${base.replace(/\.$/, "")}, ${size}.` : base;
}

function metaTag(park) {
  return (
    firstSentence(park.distinctive_finding, 110) ||
    firstSentence(park.obstacle_inventory, 110) ||
    firstSentence(park.origin_story, 110) ||
    firstSentence(park.surface_condition_detail, 110) ||
    firstSentence(park.current_condition, 110) ||
    composedDescription(park)
  );
}

/* ---------- data ---------- */

async function loadParks() {
  const response = await fetch(siteConfig.dataUrl);

  if (!response.ok) {
    throw new Error(`Could not load ${siteConfig.dataUrl} (${response.status})`);
  }

  const parks = await response.json();

  return [...parks].sort((a, b) =>
    displayName(a.park_name).localeCompare(displayName(b.park_name))
  );
}

function findPark(parks, slug) {
  return parks.find(park => parkSlug(park) === slug) || null;
}

/* ---------- map ---------- */

/* OpenStreetMap via Leaflet, following the template's map implementation:
   plain OSM tiles, custom dot markers, a layer group that is re-rendered
   on filter, and fitBounds/zoom around the mapped records. */
const MAP_FALLBACK_CENTER = [40.7128, -74.006];

// A record can be mapped only when it carries real, finite coordinates.
// (Number(null) is 0, so nulls must be excluded before the finite check.)
function mappedParks(parks) {
  return parks.filter(park =>
    park.latitude !== null && park.latitude !== undefined &&
    park.longitude !== null && park.longitude !== undefined &&
    Number.isFinite(Number(park.latitude)) &&
    Number.isFinite(Number(park.longitude))
  );
}

function createDirectoryMap(element) {
  const map = L.map(element, {
    zoomControl: false,
    scrollWheelZoom: false
  });

  L.control.zoom({
    position: "bottomright"
  }).addTo(map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);

  return map;
}

function createMapMarker(park) {
  const markerIcon = L.divIcon({
    className: "directory-marker-wrapper",
    html: '<span class="directory-marker"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14]
  });

  const marker = L.marker(
    [Number(park.latitude), Number(park.longitude)],
    { icon: markerIcon }
  );

  marker.bindPopup(`
    <div class="map-popup">
      <span class="map-popup-category">${escapeHtml(list([park.borough_name, park.skatepark_type]) || "Skatepark")}</span>
      <strong>${escapeHtml(displayName(park.park_name))}</strong>
      <span>${escapeHtml(parkLocation(park))}</span>
      <a href="${escapeAttribute(parkHref(park))}">View skatepark →</a>
    </div>
  `);

  return marker;
}

function frameMap(map, parks) {
  if (parks.length === 0) {
    map.setView(MAP_FALLBACK_CENTER, 10);
    return;
  }

  if (parks.length === 1) {
    map.setView([Number(parks[0].latitude), Number(parks[0].longitude)], 12);
    return;
  }

  map.fitBounds(
    parks.map(park => [Number(park.latitude), Number(park.longitude)]),
    { padding: [40, 40], maxZoom: 12 }
  );
}

/* ---------- site chrome ---------- */

function configureSite() {
  document.title = `${siteConfig.siteName} — ${siteConfig.title}`;

  document.querySelectorAll("[data-site-name]")
    .forEach(element => element.textContent = siteConfig.siteName);

  const kicker = document.querySelector("[data-site-kicker]");
  const title = document.querySelector("[data-site-title]");
  const description = document.querySelector("[data-site-description]");

  if (kicker) kicker.textContent = siteConfig.kicker;
  if (title) title.textContent = siteConfig.title;
  if (description) description.textContent = siteConfig.description;

  const year = document.querySelector("#current-year");
  if (year) year.textContent = new Date().getFullYear();
}

/*
  Privacy-friendly traffic hook.

  Do not identify visitors in this browser code. Count requests
  server-side and store only aggregate totals, for example:

    POST /internal/traffic/page-view
    {
      "path": "/"
    }

  Prefer server-side counters such as:
    date | path | page_views

  Do not add Google Analytics, cookies, fingerprints, or persistent
  visitor IDs unless you intentionally decide to do so later.
*/

// Example placeholder:
// fetch("/internal/traffic/page-view", {
//   method: "POST",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify({ path: window.location.pathname })
// });

/* The "Suggest an update" modal is the one interactive element both
   pages share, so it is wired once here. */
function setupFeedbackModal(entries) {
  const modal = document.querySelector("#feedback-modal");
  if (!modal) return;

  const form = document.querySelector("#feedback-form");
  const entry = document.querySelector("#feedback-entry");
  const status = document.querySelector("#feedback-status");

  document.querySelectorAll("[data-open-feedback]").forEach(button =>
    button.addEventListener("click", () => {
      entry.innerHTML = entries
        .map(item => `
          <option value="${escapeAttribute(item.value)}">
            ${escapeHtml(item.label)}
          </option>
        `)
        .join("");

      status.textContent = "";
      modal.showModal();
    })
  );

  document.querySelector("[data-close-feedback]")
    .addEventListener("click", () => modal.close());

  modal.addEventListener("click", event => {
    if (event.target === modal) modal.close();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(form);

    // Honeypot check
    if (formData.get("website")) {
      modal.close();
      return;
    }

    const message = String(formData.get("message") || "").trim();

    if (message.length < 5) {
      status.textContent = "Please add a little more detail.";
      return;
    }

    status.textContent = "Sending...";

    /*
      Replace this demo block with:

      fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData))
      });

      Your server should validate the fields, rate-limit requests,
      optionally verify a CAPTCHA, and place the submission in a
      moderation queue.
    */

    await new Promise(resolve => setTimeout(resolve, 500));

    status.textContent =
      "Thank you. Your correction has been sent for review.";

    form.reset();
  });
}