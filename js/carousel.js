/*
 * Kinky TCG — carrousel de sélection des thèmes v2
 */
(() => {
  const container = document.getElementById("themes-container");
  const dots = document.getElementById("theme-dots");
  const previous = document.getElementById("theme-prev");
  const next = document.getElementById("theme-next");

  if (!container || !dots) return;

  let activeIndex = 0;
  const getCards = () => [...container.querySelectorAll(".theme-card")];

  function updateDots() {
    const cards = getCards();
    dots.innerHTML = cards
      .map((_, index) => `<button class="carousel-dot${index === activeIndex ? " active" : ""}" type="button" aria-label="Afficher le thème ${index + 1}"></button>`)
      .join("");

    dots.querySelectorAll(".carousel-dot").forEach((dot, index) => {
      dot.addEventListener("click", () => scrollToCard(index));
    });
  }

  function scrollToCard(index) {
    const cards = getCards();
    if (!cards.length) return;

    activeIndex = Math.max(0, Math.min(index, cards.length - 1));
    cards[activeIndex].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });

    dots.querySelectorAll(".carousel-dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === activeIndex);
    });
  }

  previous?.addEventListener("click", () => scrollToCard(activeIndex - 1));
  next?.addEventListener("click", () => scrollToCard(activeIndex + 1));

  // La zone étant horizontale, transforme la molette verticale en défilement
  // horizontal. Cela fonctionne avec une souris classique comme avec un
  // trackpad, sans empêcher le défilement lorsqu'il n'y a rien à parcourir.
  container.addEventListener("wheel", event => {
    const distance = event.deltaX || event.deltaY;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (!distance || maxScrollLeft <= 0) return;

    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + distance));
    if (nextScrollLeft !== container.scrollLeft) {
      event.preventDefault();
      container.scrollLeft = nextScrollLeft;
    }
  }, { passive: false });

  // Le conteneur reçoit le focus automatiquement (autofocus dans index.html),
  // puis ces touches restent disponibles même avant tout clic dans la zone.
  container.addEventListener("keydown", event => {
    const step = Math.max(120, Math.round(container.clientWidth * 0.8));
    let targetScrollLeft;

    if (event.key === "ArrowLeft") targetScrollLeft = container.scrollLeft - step;
    if (event.key === "ArrowRight") targetScrollLeft = container.scrollLeft + step;
    if (event.key === "PageUp") targetScrollLeft = container.scrollLeft - container.clientWidth;
    if (event.key === "PageDown") targetScrollLeft = container.scrollLeft + container.clientWidth;
    if (event.key === "Home") targetScrollLeft = 0;
    if (event.key === "End") targetScrollLeft = container.scrollWidth - container.clientWidth;

    if (targetScrollLeft === undefined) return;
    event.preventDefault();
    container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: "smooth" });
  });

  container.addEventListener("scroll", () => {
    const cards = getCards();
    if (!cards.length) return;

    const center = container.scrollLeft + container.clientWidth / 2;
    activeIndex = cards.reduce((best, card, index) => {
      const currentDistance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
      const bestDistance = Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - center);
      return currentDistance < bestDistance ? index : best;
    }, 0);

    dots.querySelectorAll(".carousel-dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === activeIndex);
    });
  }, { passive: true });

  new MutationObserver(updateDots).observe(container, { childList: true });

  // Le gestionnaire du jeu masque/affiche les écrans ; on replace ensuite
  // la fenêtre en haut pour éviter de conserver la position du carrousel.
  container.addEventListener("click", event => {
    if (event.target.closest(".theme-card")) {
      requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    }
  });

  document.getElementById("back-to-selection")?.addEventListener("click", () => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      container.focus({ preventScroll: true });
    });
  });

  updateDots();
})();
