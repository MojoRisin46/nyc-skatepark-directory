/*
  Homepage: the skatepark directory.

  Renders every record from data/skateparks.json and adds search,
  filtering and sorting on top. Each card links to the reusable
  detail template at detail.html?park=<slug>.
*/

const state = {
  query: "",
  borough: "",
  type: "",
  sort: "name"
};

const grid = document.querySelector("#directory-grid");
const resultCount = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const typeSelect = document.querySelector("#type-select");
const clearSearch = document.querySelector("#clear-search");
const quickFilters = document.querySelector("#quick-filters");

const mapElement = document.querySelector("#directory-map");
const mapLocationCount = document.querySelector("#map-location-count");

let parks = [];
let directoryMap;
let markerLayer;

function searchableText(park) {
  return [
    park.park_name,
    park.aka,
    park.skater_nickname,
    park.borough_name,
    park.neighborhood,
    park.street_address,
    park.skatepark_type,
    park.surface,
    park.obstacle_inventory,
    park.distinctive_finding
  ]
    .filter(hasValue)
    .join(" ")
    .toLowerCase();
}

function getBoroughs() {
  return [...new Set(parks.map(park => park.borough_name).filter(hasValue))].sort();
}

function getTypes() {
  return [...new Set(parks.map(park => park.skatepark_type).filter(hasValue))].sort();
}

function renderBoroughFilters() {
  quickFilters.innerHTML = "";
  quickFilters.appendChild(createFilterButton("All boroughs", ""));

  getBoroughs().forEach(borough =>
    quickFilters.appendChild(createFilterButton(borough, borough))
  );
}

function createFilterButton(label, value) {
  const button = document.createElement("button");
  button.className = "filter-button";
  button.type = "button";
  button.textContent = label;

  if (state.borough === value) button.classList.add("active");

  button.addEventListener("click", () => {
    state.borough = value;
    renderBoroughFilters();
    renderDirectory();
  });

  return button;
}

function renderTypeOptions() {
  typeSelect.innerHTML = "";

  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All types";
  typeSelect.appendChild(all);

  getTypes().forEach(type => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    typeSelect.appendChild(option);
  });

  typeSelect.value = state.type;
}

/* Footprint sizes read like "7,000 sq ft", so compare the leading number. */
function numericSize(park) {
  const match = String(park.footprint_size || "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : -1;
}

function getFilteredParks() {
  const query = state.query.toLowerCase().trim();

  const filtered = parks.filter(park => {
    const matchesBorough = !state.borough || park.borough_name === state.borough;
    const matchesType = !state.type || park.skatepark_type === state.type;
    const matchesQuery = !query || searchableText(park).includes(query);

    return matchesBorough && matchesType && matchesQuery;
  });

  const byName = (a, b) =>
    displayName(a.park_name).localeCompare(displayName(b.park_name));

  return filtered.sort((a, b) => {
    if (state.sort === "borough") {
      const byBorough = String(a.borough_name).localeCompare(String(b.borough_name));
      return byBorough !== 0 ? byBorough : byName(a, b);
    }

    if (state.sort === "size") return numericSize(b) - numericSize(a);
    if (state.sort === "obstacles") return (b.obstacle_count || -1) - (a.obstacle_count || -1);

    return byName(a, b);
  });
}

function initializeMap() {
  if (!mapElement || typeof L === "undefined") {
    return;
  }

  directoryMap = createDirectoryMap(mapElement);
  markerLayer = L.layerGroup().addTo(directoryMap);
}

function renderMap(mapParks) {
  if (!directoryMap || !markerLayer) {
    return;
  }

  markerLayer.clearLayers();

  const mapped = mappedParks(mapParks);
  mapLocationCount.textContent = mapped.length;

  mapped.forEach(park => createMapMarker(park).addTo(markerLayer));
  frameMap(directoryMap, mapped);
}

function renderDirectory() {
  const filtered = getFilteredParks();

  grid.innerHTML = "";
  resultCount.textContent =
    `${filtered.length} ${filtered.length === 1 ? "skatepark" : "skateparks"}`;

  const filtering = Boolean(state.query || state.borough || state.type);
  clearSearch.classList.toggle("hidden", !filtering);
  emptyState.classList.toggle("hidden", filtered.length > 0);

  filtered.forEach((park, index) => grid.appendChild(createParkCard(park, index)));

  renderMap(filtered);
}

function createParkCard(park, index) {
  const article = document.createElement("article");
  article.className = "directory-card";

  const category = list([park.borough_name, park.skatepark_type]);
  const meta = list([
    hasValue(park.surface) ? clean(park.surface) : "",
    hasValue(park.footprint_size) ? clean(park.footprint_size) : "",
    hasValue(park.obstacle_count) ? `${park.obstacle_count} obstacles` : ""
  ]);

  article.innerHTML = `
    <div>
      <div class="card-top">
        <span class="card-category">${escapeHtml(category)}</span>
        <span class="card-number">${String(index + 1).padStart(2, "0")}</span>
      </div>
      <h3>
        <a class="card-title-link" href="${escapeAttribute(parkHref(park))}">
          ${escapeHtml(displayName(park.park_name))}
        </a>
      </h3>
      <p class="card-location">${escapeHtml(parkLocation(park))}</p>
      ${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ""}
    </div>

    <a class="card-link" href="${escapeAttribute(parkHref(park))}">
      View skatepark →
    </a>
  `;

  return article;
}

searchInput.addEventListener("input", event => {
  state.query = event.target.value;
  renderDirectory();
});

document.querySelector("#search-form").addEventListener("submit", event => {
  event.preventDefault();
  state.query = searchInput.value;
  renderDirectory();
  document.querySelector("#directory").scrollIntoView({ behavior: "smooth" });
});

sortSelect.addEventListener("change", event => {
  state.sort = event.target.value;
  renderDirectory();
});

typeSelect.addEventListener("change", event => {
  state.type = event.target.value;
  renderDirectory();
});

clearSearch.addEventListener("click", () => {
  state.query = "";
  state.borough = "";
  state.type = "";
  searchInput.value = "";
  renderTypeOptions();
  renderBoroughFilters();
  renderDirectory();
});

async function init() {
  configureSite();

  // Canonical/og:url resolved at runtime so they carry the Pages
  // project subpath instead of a domain-root "/".
  setCanonical(siteBaseUrl() + "index.html");
  setMetaTag({ property: "og:url" }, siteBaseUrl() + "index.html");

  try {
    parks = await loadParks();
  } catch (error) {
    console.error(error);
    resultCount.textContent = "Could not load the directory";
    emptyState.classList.remove("hidden");
    return;
  }

  renderBoroughFilters();
  renderTypeOptions();
  initializeMap();
  renderDirectory();

  setupFeedbackModal(
    parks.map(park => ({
      value: parkSlug(park),
      label: `${displayName(park.park_name)} — ${parkLocation(park)}`
    }))
  );
}

init();