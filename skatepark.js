/*
  The reusable skatepark detail template.

  One file renders any skatepark: it reads the slug from the URL
  (/skateparks/<slug> bookmarks still work, but the canonical URL is
   detail.html?park=<slug>),
  finds the matching record and binds the page to it.

  Only fields that exist for that skatepark are rendered. Nothing is
  invented and no empty section is shown.
*/

/* ---------- record formatting ---------- */

/* Some fields list several items separated by "|". When the fragments
   read as short items, return them as a list; otherwise the pipe was
   used mid-sentence, so keep the value as prose. */
function pipeItems(value) {
  const parts = String(value)
    .split("|")
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const itemLike = parts.filter(part => part.length <= 80 && !/[.!?]$/.test(part));
  return itemLike.length >= parts.length * 0.6 ? parts : null;
}

function asProse(value) {
  return dropPlaceholders(String(value).replace(/\s*\|\s*/g, " — "));
}

/* Flags such as has_ledges are true/false, or occasionally a note. */
const TERRAIN_FLAGS = [
  ["has_flatground", "Flat ground"],
  ["has_ledges", "Ledges"],
  ["has_rails", "Rails"],
  ["has_stairs", "Stairs"],
  ["has_bowl_transition", "Bowl / transition"],
  ["has_pump_track", "Pump track"]
];

/* Rows are only rendered when their value exists. */
/* `isDuplicate` drops values already shown elsewhere on the page, since
   the source copies some paragraphs into several fields. */
function listRows(pairs, isDuplicate = () => false) {
  return pairs
    .map(([label, value]) => [label, hasValue(value) && !isDuplicate(value) ? asProse(value) : ""])
    .filter(([, value]) => value !== "");
}

function orderedRows(pairs, isDuplicate = () => false) {
  return pairs
    .map(([label, value]) => [label, hasValue(value) && !isDuplicate(value) ? String(value).trim() : ""])
    .filter(([, value]) => value !== "");
}

function rowsHtml(rows) {
  return rows
    .map(([label, value]) => `
      <div class="fact-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `)
    .join("");
}

function section(id, heading, body, modifier = "") {
  const classes = ["park-section", modifier].filter(Boolean).join(" ");

  return `
    <section class="${classes}" id="${id}">
      <div class="park-section-heading">
        <h2>${escapeHtml(heading)}</h2>
      </div>
      ${body}
    </section>
  `;
}

function proseBlock(title, value, isDuplicate = () => false) {
  if (!hasValue(value) || isDuplicate(value)) return "";

  return `
    <div class="prose-block">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(asProse(value))}</p>
    </div>
  `;
}

function factsBlock(rows, id = "") {
  if (!rows.length) return "";

  return `<dl class="fact-list" ${id ? `id="${id}"` : ""}>${rowsHtml(rows)}</dl>`;
}

/* ---------- sections ---------- */

function factsSection(park) {
  const rows = orderedRows([
    ["Borough", park.borough_name],
    ["Neighborhood", park.neighborhood],
    ["Address", park.street_address],
    ["Type", park.skatepark_type],
    ["Surface", park.surface],
    ["Footprint", park.footprint_size],
    ["Property size", park.property_acres === null || park.property_acres === undefined ? "" : `${park.property_acres} acres`],
    ["Opened", park.opened_year],
    ["Hours", park.official_hours],
    ["Access", park.access_type],
    ["Skill level", park.skill_level],
    ["Supervision", park.supervision],
    ["Status", park.is_active === true ? "Active" : park.is_active === false ? "Closed" : ""]
  ]);

  const body = factsBlock(rows);
  return body.trim() ? section("facts", "Facts", body) : "";
}

function obstaclesSection(park) {
  const items = hasValue(park.obstacle_inventory) ? pipeItems(park.obstacle_inventory) : null;
  const inventory = items
    ? `<ul class="obstacle-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : hasValue(park.obstacle_inventory)
      ? `<p class="park-prose">${escapeHtml(asProse(park.obstacle_inventory))}</p>`
      : "";

  const flags = TERRAIN_FLAGS
    .filter(([key]) => park[key] === true || park[key] === false)
    .map(([key, label]) => `<span class="tag">${escapeHtml(flagText(park[key], label))}</span>`);

  const body = `
    ${hasValue(park.obstacle_count) ? `<p class="section-note">${escapeHtml(String(park.obstacle_count))} documented obstacles</p>` : ""}
    ${flags.length ? `<div class="tag-row obstacle-flags">${flags.join("")}</div>` : ""}
    ${inventory}
  `;

  return body.replace(/\s/g, "") ? section("obstacles", "Obstacles", body) : "";
}

function conditionsSection(park, isDuplicate) {
  const rows = listRows([
    ["Seasonal notes", park.seasonal_notes],
    ["Weather suitability", park.weather_suitability],
    ["Current condition", park.current_condition],
    ["Surface condition", park.surface_condition_detail],
    ["Shade and shelter", park.shade_and_shelter],
    ["Busyness", park.busyness_level],
    ["Peak times", park.busyness_timing]
  ], isDuplicate);

  const blocks = [
    proseBlock("Lighting", hasValue(park.lighting) ? flagText(park.lighting, "Lighting") : "", isDuplicate),
    proseBlock("Safety notes", park.safety_notes, isDuplicate),
    proseBlock("Location quirks", park.location_quirks, isDuplicate)
  ].join("");

  const body = `${factsBlock(rows)}${blocks}`;
  return body.trim() ? section("conditions", "Conditions and use", body) : "";
}

function cultureSection(park, isDuplicate) {
  const rows = listRows([
    ["Also known as", park.aka],
    ["Nickname", park.skater_nickname],
    ["Etiquette", park.etiquette],
    ["Vibe", park.vibe],
    ["Named after", park.named_after],
    ["Film and TV", park.film_tv_location]
  ], isDuplicate);

  const blocks = [
    proseBlock("Local scene", park.local_scene, isDuplicate),
    proseBlock("For beginners", park.beginner_friendliness, isDuplicate),
    proseBlock("For advanced skaters", park.advanced_friendliness, isDuplicate),
    proseBlock("Community events", park.community_events, isDuplicate),
    proseBlock("Lessons and programs", park.lessons_programs, isDuplicate),
    proseBlock("Cultural significance", park.cultural_significance, isDuplicate),
    proseBlock("Trivia", park.trivia, isDuplicate)
  ].join("");

  const body = `${factsBlock(rows)}${blocks}`;
  return body.trim() ? section("culture", "Scene and culture", body) : "";
}

function historySection(park, isDuplicate) {
  const rows = orderedRows([
    ["Designer", park.designer],
    ["Builder", park.builder],
    ["Funding", park.funding_cost],
    ["Funding sources", park.funding_sources],
    ["Capital project", park.capital_project_id === null || park.capital_project_id === undefined ? "" : `#${park.capital_project_id}`]
  ], isDuplicate);

  const blocks = [
    proseBlock("Opening", park.opened, isDuplicate),
    proseBlock("Origin story", park.origin_story, isDuplicate),
    proseBlock("History", park.history, isDuplicate),
    proseBlock("Status history", park.status_history, isDuplicate),
    proseBlock("Renovations", park.renovations_history, isDuplicate)
  ].join("");

  const body = `${factsBlock(rows)}${blocks}`;
  return body.trim() ? section("history", "History", body) : "";
}

function accessSection(park, isDuplicate) {
  const yesNo = value =>
    value === true ? "Yes" : value === false ? "No" : "";

  const rows = listRows([
    ["Getting there", park.transit_access],
    ["Parking", park.parking],
    ["Restrooms", park.restrooms],
    ["Water fountain", park.water_fountain],
    ["Seating and shade", park.seating_shade],
    ["Wi-Fi", park.wifi],
    ["Food nearby", park.food_nearby],
    ["Nearby spots", park.nearby_spots],
    ["Accessibility", park.accessibility],
    ["Gear requirement", park.gear_requirement],
    ["Age restriction", park.age_restriction]
  ], isDuplicate);

  const allowed = [
    ["Skateboards", park.allowed_skateboards],
    ["BMX", park.allowed_bmx],
    ["Scooters", park.allowed_scooters],
    ["Inline skates", park.allowed_inline],
    ["Bikes", park.allowed_bikes]
  ]
    .filter(([, value]) => hasValue(yesNo(value)))
    .map(([label, value]) => `<span class="tag">${escapeHtml(label)}: ${escapeHtml(yesNo(value))}</span>`);

  const body = `
    ${factsBlock(rows)}
    ${allowed.length ? `<div class="tag-row allowed-row">${allowed.join("")}</div>` : ""}
  `;

  return body.replace(/\s/g, "") ? section("access", "Access and facilities", body) : "";
}

function linksList(items) {
  return `<ul class="link-list">${items
    .map(item => {
      const url = typeof item === "string" ? item : item.url;
      const label = typeof item === "string" ? item : item.title || item.url;

      if (!hasValue(url)) return "";
      return `<li><a href="${escapeAttribute(url)}" rel="noopener">${escapeHtml(label)}</a></li>`;
    })
    .join("")}</ul>`;
}

function fieldSourcesTable(sources) {
  const entries = Object.entries(sources).filter(([, value]) => hasValue(value));
  if (!entries.length) return "";

  return `
    <details class="source-details">
      <summary>Field sources (${entries.length})</summary>
      <dl class="fact-list">
        ${entries
          .map(([key, value]) => `
            <div class="fact-row">
              <dt>${escapeHtml(key.replace(/_/g, " "))}</dt>
              <dd>${escapeHtml(String(value))}</dd>
            </div>
          `)
          .join("")}
      </dl>
    </details>
  `;
}

function referencesSection(park, isDuplicate) {
  const hasCoordinates =
    park.latitude !== null && park.latitude !== undefined &&
    park.longitude !== null && park.longitude !== undefined;

  const rows = orderedRows([
    ["Coordinates", hasCoordinates ? `${park.latitude}, ${park.longitude}` : ""],
    ["ZIP", park.zip],
    ["Community board", park.community_board],
    ["Council district", park.council_district],
    ["Rating", park.community_rating === null || park.community_rating === undefined ? "" : `${park.community_rating} / 5`],
    ["Last verified", park.last_verified],
    ["Park ID", park.park_id],
    ["GIS property number", park.gispropnum],
    ["Timeline system ID", park.timeline_system_id]
  ]);

  const external = [];
  if (hasValue(park.park_url)) external.push({ url: park.park_url, title: "Official park page" });
  if (Array.isArray(park.external_links)) external.push(...park.external_links);
  if (Array.isArray(park.videos)) external.push(...park.videos);

  const sourceLinks = hasValue(park.sources)
    ? String(park.sources)
        .split("|")
        .map(part => part.trim())
        .filter(part => /^https?:\/\//.test(part))
    : [];

  const blocks = [
    proseBlock("Evidence", park.evidence_quotes, isDuplicate),
    proseBlock("Open questions", park.open_questions, isDuplicate),
    proseBlock("Confidence notes", park.confidence_notes, isDuplicate),
    proseBlock("Source conflicts", park.source_conflicts, isDuplicate),
    proseBlock("Identity verification", park.identity_verification, isDuplicate),
    proseBlock("Planned future", park.planned_future, isDuplicate),
    proseBlock("Issues and advocacy", park.issues_advocacy, isDuplicate),
    hasValue(park.field_sources) ? fieldSourcesTable(park.field_sources) : ""
  ].join("");

  const body = `
    ${factsBlock(rows)}
    ${external.length ? `<div class="prose-block"><h3>Links</h3>${linksList(external)}</div>` : ""}
    ${sourceLinks.length ? `<div class="prose-block"><h3>Sources</h3>${linksList(sourceLinks)}</div>` : ""}
    ${blocks}
  `;

  return body.replace(/\s/g, "") ? section("references", "References", body) : "";
}

/* ---------- page ---------- */

/* The detail map shows this skatepark only. Records without coordinates
   keep the section hidden, in line with "only what exists is rendered". */
function renderDetailMap(park) {
  const section = document.querySelector("#map-section");
  const element = document.querySelector("#directory-map");

  if (!section || !element) return;

  const mapped = mappedParks([park]);
  section.hidden = mapped.length === 0;

  if (!mapped.length || typeof L === "undefined") return;

  const map = createDirectoryMap(element);
  const layer = L.layerGroup().addTo(map);
  createMapMarker(park).addTo(layer);
  frameMap(map, mapped);

  document.querySelector("#map-location-count").textContent = mapped.length;
}

function renderHero(park) {
  const name = displayName(park.park_name);

  document.querySelector("#park-eyebrow").textContent =
    list([park.skatepark_type, park.borough_name]) || "Skatepark";

  document.querySelector("#park-title").textContent = name;

  const summary = parkSummary(park);
  const summaryEl = document.querySelector("#park-summary");
  summaryEl.textContent = summary;
  summaryEl.hidden = !summary;

  const tags = [
    park.borough_name,
    park.neighborhood,
    park.skatepark_type,
    park.surface,
    park.footprint_size,
    hasValue(park.opened_year) ? `Opened ${park.opened_year}` : ""
  ];

  document.querySelector("#park-tags").innerHTML = tags
    .filter(hasValue)
    .map(tag => `<span class="tag">${escapeHtml(String(tag).trim())}</span>`)
    .join("");

  const crumb = parkBreadcrumb(park, siteBaseUrl());
  document.querySelector("#breadcrumb").innerHTML = crumb.html;
  setJsonLd("breadcrumb-jsonld", crumb.json);
}

function renderRecord(park) {
  const record = document.querySelector("#park-record");

  // One deduper per page so the same paragraph is never printed twice,
  // no matter how many source fields carry it.
  const isDuplicate = createDeduper();

  // The hero lede is shown in full at the top of the page, so seed the
  // deduper with it: later fields repeating that text are dropped.
  const summaryField = parkSummaryField(park);
  if (summaryField) isDuplicate(park[summaryField]);

  const sections = [
    factsSection(park),
    obstaclesSection(park),
    conditionsSection(park, isDuplicate),
    cultureSection(park, isDuplicate),
    historySection(park, isDuplicate),
    accessSection(park, isDuplicate),
    referencesSection(park, isDuplicate)
  ].filter(Boolean);

  record.innerHTML = sections.join("");
  record.hidden = false;
}

function renderSeo(park) {
  const name = displayName(park.park_name);
  const borough = hasValue(park.borough_name) ? clean(park.borough_name) : "";
  const description = metaTag(park);
  const pageTitle = parkTitle(park);

  document.title = pageTitle;

  setMetaTag({ name: "description" }, description);
  setMetaTag({ name: "robots" }, "index, follow");
  setMetaTag({ property: "og:title" }, pageTitle);
  setMetaTag({ property: "og:description" }, description);
  setMetaTag({ property: "og:type" }, "article");
  setMetaTag({ property: "og:url" }, siteBaseUrl() + parkPath(park));
  setCanonical(siteBaseUrl() + parkPath(park));

  const geo =
    park.latitude !== null && park.latitude !== undefined &&
    park.longitude !== null && park.longitude !== undefined
      ? { "@type": "GeoCoordinates", latitude: park.latitude, longitude: park.longitude }
      : undefined;

  const city = [borough, "NY"].filter(Boolean).join(", ");

  setJsonLd("park-jsonld", {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: `${name}${borough ? `, ${borough}` : ""}`,
    description,
    url: siteBaseUrl() + parkPath(park),
    ...(geo ? { geo } : {}),
    address: {
      "@type": "PostalAddress",
      ...(hasValue(park.street_address) ? { streetAddress: clean(park.street_address) } : {}),
      addressLocality: borough || "New York",
      addressRegion: "NY",
      ...(hasValue(park.zip) ? { postalCode: String(park.zip) } : {}),
      addressCountry: "US"
    },
    ...(hasValue(park.official_hours) ? { openingHours: clean(park.official_hours) } : {}),
    ...(park.access_type === "free" ? { isAccessibleForFree: true } : {}),
    ...(hasValue(park.park_url) ? { sameAs: [clean(park.park_url)] } : {})
  });
}

function renderNotFound(slug) {
  document.title = `Skatepark not found — ${siteConfig.siteName}`;
  setMetaTag({ name: "robots" }, "noindex, follow");

  document.querySelector("#park-main").hidden = true;

  const notFound = document.querySelector("#not-found");
  notFound.hidden = false;

  if (slug) {
    notFound.querySelector("p").textContent =
      `There is no skatepark at “detail.html?park=${slug}” in the directory.`;
  }
}

/* The slug comes from detail.html?park=<slug>. The old pretty-URL form
   (/skateparks/<slug>) is still parsed as a fallback for bookmarks, but
   the site only ever generates query-parameter links. */
function currentSlug() {
  const fromQuery = new URLSearchParams(window.location.search).get("park");
  if (fromQuery) return fromQuery;

  const match = window.location.pathname.match(/\/skateparks\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function init() {
  configureSite();

  const slug = currentSlug();
  let parks = [];

  try {
    parks = await loadParks();
  } catch (error) {
    console.error(error);
    renderNotFound(slug);
    return;
  }

  setupFeedbackModal(
    parks.map(park => ({
      value: parkSlug(park),
      label: `${displayName(park.park_name)} — ${parkLocation(park)}`
    }))
  );

  const park = slug ? findPark(parks, slug) : null;

  if (!park) {
    renderNotFound(slug);
    return;
  }

  renderSeo(park);
  renderHero(park);
  renderDetailMap(park);
  renderRecord(park);
}

init();