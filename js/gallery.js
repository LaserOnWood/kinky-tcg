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
    lightboxPath: document.getElementById("lightbox-path"),
    close: document.getElementById("lightbox-close")
  };

  const state = { inventory: { images: [] }, search: "", category: "Toutes" };

  const dateLabel = (value) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "indisponible";
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", "\"":"&quot;" })[character]);

  function visibleImages() {
    const needle = state.search.trim().toLocaleLowerCase("fr-FR");
    return state.inventory.images.filter((image) => {
      const matchesCategory = state.category === "Toutes" || image.category === state.category;
      const haystack = `${image.name} ${image.path} ${image.extension}`.toLocaleLowerCase("fr-FR");
      return matchesCategory && (!needle || haystack.includes(needle));
    });
  }

  function renderFilters() {
    const categories = ["Toutes", ...new Set(state.inventory.images.map((image) => image.category))];
    elements.filters.innerHTML = categories.map((category) => `<button class="filter-button ${category === state.category ? "is-active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
    elements.filters.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.category; render(); }));
  }

  function renderGrid(images) {
    elements.grid.innerHTML = images.map((image, index) => `
      <article class="gallery-card">
        <button type="button" class="gallery-card-button" data-id="${escapeHtml(image.id)}" aria-label="Ouvrir ${escapeHtml(image.name)}">
          <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.name)}" loading="${index < 8 ? "eager" : "lazy"}">
          <span class="gallery-card-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="gallery-card-open"><i class="fa-solid fa-expand" aria-hidden="true"></i></span>
        </button>
        <div class="gallery-card-info"><div><h3 title="${escapeHtml(image.name)}">${escapeHtml(image.name)}</h3><p>${escapeHtml(image.path)}</p></div><div class="gallery-card-tags"><span>${escapeHtml(image.extension)}</span><span>${escapeHtml(image.sizeLabel)}</span></div></div>
      </article>`).join("");
    elements.grid.querySelectorAll(".gallery-card-button").forEach((button) => button.addEventListener("click", () => openLightbox(state.inventory.images.find((image) => image.id === button.dataset.id))));
  }

  function render() {
    const images = visibleImages();
    renderFilters();
    renderGrid(images);
    elements.shownCount.textContent = `${images.length} résultat${images.length > 1 ? "s" : ""}`;
    elements.empty.hidden = images.length > 0;
    elements.grid.hidden = images.length === 0;
  }

  function openLightbox(image) {
    if (!image) return;
    elements.lightboxImage.src = image.src;
    elements.lightboxImage.alt = image.name;
    elements.lightboxTitle.textContent = image.name;
    elements.lightboxMeta.textContent = `${image.category} · ${image.extension} · ${image.sizeLabel}`;
    elements.lightboxPath.textContent = image.path;
    elements.lightbox.hidden = false;
    elements.close.focus();
  }

  function closeLightbox() { elements.lightbox.hidden = true; elements.lightboxImage.src = ""; }

  async function loadGallery() {
    try {
      const response = await fetch(`json/gallery.json?updated=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Inventaire indisponible");
      state.inventory = await response.json();
      elements.heroCount.textContent = String(state.inventory.count || 0).padStart(2, "0");
      elements.lastUpdated.textContent = `Mise à jour : ${dateLabel(state.inventory.generatedAt)}`;
      render();
    } catch (error) {
      elements.empty.hidden = false;
      elements.empty.querySelector("h2").textContent = "Inventaire indisponible.";
      elements.empty.querySelector("p").textContent = "Lancez pnpm gallery:index pour générer json/gallery.json.";
      elements.shownCount.textContent = "erreur";
      console.error(error);
    } finally {
      elements.loading.hidden = true;
    }
  }

  elements.search.addEventListener("input", (event) => { state.search = event.target.value; render(); });
  elements.close.addEventListener("click", closeLightbox);
  elements.lightbox.addEventListener("click", (event) => { if (event.target === elements.lightbox) closeLightbox(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeLightbox(); });
  void loadGallery();
})();
