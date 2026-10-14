/*
 * Kinky TCG — carrousels (thèmes + cartes du jeu) v3
 * - Carrousel de sélection des thèmes (flèches, points, glisser, clavier)
 * - Molette de souris : un cran = une carte, dans les thèmes ET dans le jeu
 */

/* ===========================================================================
   MOLETTE DE SOURIS → UN CRAN = UNE CARTE (compatible scroll-snap)
   ---------------------------------------------------------------------------
   zone      : élément qui capte la molette
   conteneur : élément qui défile horizontalement
   selecteur : sélecteur CSS des cartes à parcourir
   =========================================================================== */
function activerMolette({ zone, conteneur, selecteur }) {
  if (!zone || !conteneur) return;

  const reduireMouvement = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let cible = null;       // index de la carte visée pendant le défilement
  let cibleScroll = 0;    // position de défilement (px) correspondant à cette carte
  let animation = null;   // identifiant requestAnimationFrame
  let dernierTemps = 0;
  let verrou = false;     // trackpad : une seule carte par geste
  let cumul = 0;          // trackpad : cumul des petits déplacements
  let resetCumul;

  // Index de la carte la plus proche du centre visible du conteneur.
  const carteCentrale = (cartes) => {
    const rect = conteneur.getBoundingClientRect();
    const centre = rect.left + rect.width / 2;
    let meilleure = 0;
    let meilleureDistance = Infinity;
    cartes.forEach((carte, index) => {
      const r = carte.getBoundingClientRect();
      const distance = Math.abs(r.left + r.width / 2 - centre);
      if (distance < meilleureDistance) {
        meilleureDistance = distance;
        meilleure = index;
      }
    });
    return meilleure;
  };

  // Arrête l'animation et rend la main au navigateur (snap + défilement fluide du CSS).
  const arreter = () => {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
    cible = null;
    conteneur.style.scrollSnapType = "";
    conteneur.style.scrollBehavior = "";
  };

  // Une image de l'animation : on se rapproche de la cible (jamais de blocage).
  const pas = (temps) => {
    const dt = Math.min(50, temps - dernierTemps);
    dernierTemps = temps;

    const ecart = cibleScroll - conteneur.scrollLeft;
    if (Math.abs(ecart) < 0.5) {
      conteneur.scrollLeft = cibleScroll;
      arreter(); // le snap se réactive et reste sur la carte centrée
      return;
    }

    let delta = ecart * (1 - Math.exp(-dt / 90));
    if (Math.abs(delta) < 1) delta = Math.sign(ecart) * Math.min(1, Math.abs(ecart));
    conteneur.scrollLeft += delta;
    animation = requestAnimationFrame(pas);
  };

  // Avance d'une carte à partir de la carte déjà visée (ou de la carte centrale).
  // Chaque appel s'additionne : 5 crans rapprochés = 5 cartes.
  const aller = (cartes, sens) => {
    const depart = cible ?? carteCentrale(cartes);
    const arrivee = Math.max(0, Math.min(cartes.length - 1, depart + sens));
    if (arrivee === depart) return;

    cible = arrivee;
    const rect = conteneur.getBoundingClientRect();
    const r = cartes[arrivee].getBoundingClientRect();
    const max = conteneur.scrollWidth - conteneur.clientWidth;
    cibleScroll = Math.max(0, Math.min(max,
      conteneur.scrollLeft + (r.left + r.width / 2) - (rect.left + rect.width / 2)));

    if (reduireMouvement) {
      arreter();
      conteneur.scrollLeft = cibleScroll;
      return;
    }

    // Pendant l'animation, on suspend le snap et le défilement fluide du CSS.
    conteneur.style.scrollSnapType = "none";
    conteneur.style.scrollBehavior = "auto";
    if (animation === null) {
      dernierTemps = performance.now();
      animation = requestAnimationFrame(pas);
    }
  };

  // Si l'utilisateur touche ou fait glisser le carrousel, on arrête l'animation.
  conteneur.addEventListener("pointerdown", arreter);
  conteneur.addEventListener("touchstart", arreter, { passive: true });

  zone.addEventListener("wheel", (event) => {
    if (event.ctrlKey) return;                                   // zoom par pincement
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return; // geste horizontal : géré nativement

    const cartes = [...conteneur.querySelectorAll(selecteur)];
    if (cartes.length < 2 || conteneur.scrollWidth <= conteneur.clientWidth) return;
    if (!event.deltaY) return;

    event.preventDefault();
    const sens = event.deltaY > 0 ? 1 : -1;

    // Molette de souris (crans nets) : chaque cran = une carte, sans blocage.
    const estCran = event.deltaMode !== 0 || Math.abs(event.deltaY) >= 50;
    if (estCran) {
      aller(cartes, sens);
      return;
    }

    // Trackpad (nombreux petits déplacements) : une carte par geste.
    if (verrou) return;
    cumul += event.deltaY;
    clearTimeout(resetCumul);
    resetCumul = setTimeout(() => { cumul = 0; }, 200);
    if (Math.abs(cumul) < 40) return;

    aller(cartes, cumul > 0 ? 1 : -1);
    cumul = 0;
    verrou = true;
    setTimeout(() => { verrou = false; }, 450);
  }, { passive: false });
}

/* ===========================================================================
   CARROUSEL DE SÉLECTION DES THÈMES
   =========================================================================== */
(() => {
  const container = document.getElementById("themes-container");
  const dots = document.getElementById("theme-dots");
  const previous = document.getElementById("theme-prev");
  const next = document.getElementById("theme-next");

  if (!container || !dots) return;

  let activeIndex = 0;
  let dotButtons = [];
  const getCards = () => [...container.querySelectorAll(".theme-card")];

  function updateDots() {
    const cards = getCards();
    dots.innerHTML = cards
      .map((_, index) => `<button class="carousel-dot${index === activeIndex ? " active" : ""}" type="button" aria-label="Afficher le thème ${index + 1}"></button>`)
      .join("");
    dotButtons = [...dots.querySelectorAll(".carousel-dot")];
  }

  function markActiveDot() {
    dotButtons.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === activeIndex);
    });
  }

  // Un seul écouteur pour tous les points (ils sont reconstruits à chaque changement de liste).
  dots.addEventListener("click", event => {
    const dot = event.target.closest(".carousel-dot");
    if (dot) scrollToCard(dotButtons.indexOf(dot));
  });

  function scrollToCard(index) {
    const cards = getCards();
    if (!cards.length) return;

    activeIndex = Math.max(0, Math.min(index, cards.length - 1));
    cards[activeIndex].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });

    markActiveDot();
  }

  previous?.addEventListener("click", () => scrollToCard(activeIndex - 1));
  next?.addEventListener("click", () => scrollToCard(activeIndex + 1));

  // Molette : un thème à la fois (le scroll-snap du CSS annulait les petits
  // défilements pixel par pixel de l'ancienne version).
  activerMolette({
    zone: container.closest(".themes-stage"),
    conteneur: container,
    selecteur: ".theme-card"
  });

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

  // Le calcul de la carte centrale (qui lit la mise en page) est fait au plus une fois
  // par image affichée, et les points ne sont touchés que si la carte active change.
  let calculPlanifie = false;
  container.addEventListener("scroll", () => {
    if (calculPlanifie) return;
    calculPlanifie = true;

    requestAnimationFrame(() => {
      calculPlanifie = false;
      const cards = getCards();
      if (!cards.length) return;

      const center = container.scrollLeft + container.clientWidth / 2;
      const newIndex = cards.reduce((best, card, index) => {
        const currentDistance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        const bestDistance = Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - center);
        return currentDistance < bestDistance ? index : best;
      }, 0);

      if (newIndex === activeIndex) return;
      activeIndex = newIndex;
      markActiveDot();
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

/* ===========================================================================
   CARTES DU JEU : molette (valable aussi pour le thème Hasard)
   =========================================================================== */
activerMolette({
  zone: document.getElementById("grid"),
  conteneur: document.getElementById("grid"),
  selecteur: ".card-slot"
});