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
  // horizontal. La conversion de deltaMode évite les écarts entre souris,
  // trackpads et navigateurs.
  const handleWheel = event => {
    const themesStage = container.closest(".themes-stage");
    if (!themesStage?.contains(event.target)) return;

    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientWidth : 1;
    // Une roulette classique envoie deltaY ; une roulette horizontale ou un
    // trackpad peut envoyer deltaX. On ne les additionne pas pour éviter une
    // annulation lorsque les deux axes sont renseignés.
    const rawDistance = Math.abs(event.deltaY) > 0 ? event.deltaY : event.deltaX;
    const distance = rawDistance * unit;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (!Number.isFinite(distance) || !distance || maxScrollLeft <= 0) return;

    const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + distance));
    event.preventDefault();
    container.scrollTo({ left: nextScrollLeft, behavior: "smooth" });
  };

  // Capture au niveau document : certains navigateurs traitent la molette
  // avant le conteneur scrollable, notamment quand le pointeur est sur une
  // carte enfant.
  document.addEventListener("wheel", handleWheel, { passive: false, capture: true });

  // Alternative fiable avec une souris qui ne possède pas de molette horizontale.
  let dragStartX = 0;
  let dragStartScrollLeft = 0;
  let isDragging = false;
  let suppressClick = false;

  container.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    dragStartX = event.clientX;
    dragStartScrollLeft = container.scrollLeft;
    isDragging = false;
  });

  container.addEventListener("pointermove", event => {
    if (event.pointerType === "touch" || event.buttons !== 1) return;
    const distance = event.clientX - dragStartX;
    if (Math.abs(distance) > 5 && !isDragging) {
      isDragging = true;
      // La capture ne démarre qu'après un déplacement réel, afin qu'un clic
      // simple conserve sa cible .theme-card et déclenche la sélection.
      container.setPointerCapture?.(event.pointerId);
    }
    if (isDragging) {
      event.preventDefault();
      container.scrollLeft = dragStartScrollLeft - distance;
    }
  });

  container.addEventListener("pointerup", event => {
    if (container.hasPointerCapture?.(event.pointerId)) container.releasePointerCapture?.(event.pointerId);
    suppressClick = isDragging;
    isDragging = false;
  });

  container.addEventListener("click", event => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  }, true);

  // Le conteneur reçoit le focus automatiquement (autofocus dans index.html),
  // puis ces touches restent disponibles même avant tout clic dans la zone.
  container.addEventListener("keydown", event => {
    let targetScrollLeft;

    // Les flèches changent de thème un par un et le centrent dans la zone.
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      scrollToCard(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }

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
