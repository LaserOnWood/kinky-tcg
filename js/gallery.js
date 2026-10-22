(() => {
  const elements = {
    grid: document.getElementById("gallery-grid"),
    loading: document.getElementById("gallery-loading"),
    empty: document.getElementById("gallery-empty"),
    search: document.getElementById("catalog-search"),
    filters: document.getElementById("catalog-filters"),
    shownCount: document.getElementById("shown-count"),
    heroCount: document.getElementById("hero-count"),
    lastUpdated: document.getElementById("last-updated"),
    lightbox: document.getElementById("gallery-lightbox"),
    lightboxImage: document.getElementById("lightbox-image"),
    lightboxTitle: document.getElementById("lightbox-title"),
    lightboxMeta: document.getElementById("lightbox-meta"),
    close: document.getElementById("lightbox-close")
  };

  const state = { inventory: { images: [] }, search: "", category: "Toutes" };

  const dateLabel = (value) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "indisponible";

  function visibleImages() {
    const needle = state.search.trim().toLocaleLowerCase("fr-FR");
    return state.inventory.images.filter((image) => {
      const matchesCategory = state.category === "Toutes" || image.category === state.category;
      const haystack = `${image.name} ${image.extension} ${image.category}`.toLocaleLowerCase("fr-FR");
      return matchesCategory && (!needle || haystack.includes(needle));
    });
  }

  function renderFilters() {
    const categories = ["Toutes", ...new Set(state.inventory.images.map((image) => image.category))];
    elements.filters.innerHTML = categories.map((category) => `<button class="filter-button ${category === state.category ? "is-active" : ""}" type="button" data-category="${echapperHTML(category)}">${echapperHTML(category)}</button>`).join("");
    elements.filters.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.category; render(); }));
  }

  function renderGrid(images) {
    elements.grid.innerHTML = images.map((image, index) => `
      <article class="gallery-card">
        <button type="button" class="gallery-card-button" data-id="${echapperHTML(image.id)}" aria-label="Ouvrir ${echapperHTML(image.name)}">
          <img src="${echapperHTML(image.src)}" alt="${echapperHTML(image.name)}" loading="${index < 8 ? "eager" : "lazy"}">
          <span class="gallery-card-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="gallery-card-open"><i class="ic ic-expand" aria-hidden="true"></i></span>
        </button>
        <div class="gallery-card-info"><h3 title="${echapperHTML(image.name)}">${echapperHTML(image.name)}</h3><span class="gallery-card-format">${echapperHTML(image.extension)}</span></div>
      </article>`).join("");
    elements.grid.querySelectorAll(".gallery-card-button").forEach((button) => button.addEventListener("click", () => openLightbox(state.inventory.images.find((image) => image.id === button.dataset.id), button)));
  }

  function render() {
    const images = visibleImages();
    renderFilters();
    renderGrid(images);
    elements.shownCount.textContent = `${images.length} résultat${images.length > 1 ? "s" : ""}`;
    elements.empty.hidden = images.length > 0;
    elements.grid.hidden = images.length === 0;
  }

  // Comportement commun des modales (Échap, focus, arrière-plan inactif) : voir utils.js.
  const lightbox = creerModale(elements.lightbox, {
    focusInitial: elements.close,
    apresFermeture: () => { elements.lightboxImage.src = ""; }
  });

  function openLightbox(image, trigger) {
    if (!image) return;
    elements.lightboxImage.src = image.src;
    elements.lightboxImage.alt = image.name;
    elements.lightboxTitle.textContent = image.name;
    elements.lightboxMeta.textContent = image.extension;
    lightbox.ouvrir(trigger);
  }

  function closeLightbox() { lightbox.fermer(); }

  async function loadGallery() {
    try {
      // URL stable : le service worker conserve une seule entrée de cache pour l'inventaire.
      const response = await fetch("json/gallery.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Inventaire indisponible");
      state.inventory = await response.json();
      elements.heroCount.textContent = String(state.inventory.count || 0).padStart(2, "0");
      elements.lastUpdated.textContent = `Mise à jour : ${dateLabel(state.inventory.generatedAt)}`;
      render();
    } catch (error) {
      elements.empty.hidden = false;
      elements.empty.querySelector("h2").textContent = "Inventaire indisponible.";
      elements.empty.querySelector("p").textContent = "Lancez npm gallery:index pour générer json/gallery.json.";
      elements.shownCount.textContent = "erreur";
      console.error(error);
    } finally {
      elements.loading.hidden = true;
    }
  }

  let debounce; elements.search.addEventListener("input", (event) => { clearTimeout(debounce); debounce = setTimeout(() => { state.search = event.target.value; render(); }, 120);});
  elements.close.addEventListener("click", closeLightbox);
  elements.lightbox.addEventListener("click", (event) => { if (event.target === elements.lightbox) closeLightbox(); });
  void loadGallery();
})();
