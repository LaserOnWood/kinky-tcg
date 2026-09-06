/* ===========================================================================
   GESTION DES SONS DU JEU
   ---------------------------------------------------------------------------
   Les sons sont désactivés ou activés depuis le bouton #sound-toggle.
   La préférence est conservée dans localStorage entre les sessions.
   =========================================================================== */

const AUDIO_MUTED_STORAGE_KEY = "kinky_tcg_audio_muted";

const sons = {
  bonneReponse: new Audio("assets/audio/bonne-reponse.mp3"),
  erreur: new Audio("assets/audio/erreur.mp3")
};

sons.bonneReponse.volume = 0.6;
sons.erreur.volume = 0.45;

let sonsDesactives = chargerPreferenceAudio();

function chargerPreferenceAudio() {
  try {
    return localStorage.getItem(AUDIO_MUTED_STORAGE_KEY) === "true";
  } catch (erreur) {
    console.warn("Impossible de lire la préférence audio :", erreur);
    return false;
  }
}

function sauvegarderPreferenceAudio() {
  try {
    localStorage.setItem(AUDIO_MUTED_STORAGE_KEY, String(sonsDesactives));
  } catch (erreur) {
    console.warn("Impossible de sauvegarder la préférence audio :", erreur);
  }
}

function mettreAJourBoutonAudio() {
  const bouton = document.getElementById("sound-toggle");
  if (!bouton) return;

  const icone = bouton.querySelector("i");
  const libelle = bouton.querySelector(".sound-toggle-label");
  const audioActive = !sonsDesactives;

  bouton.setAttribute("aria-pressed", String(audioActive));
  bouton.setAttribute(
    "aria-label",
    audioActive ? "Désactiver les sons" : "Activer les sons"
  );
  bouton.setAttribute(
    "title",
    audioActive ? "Désactiver les sons" : "Activer les sons"
  );

  if (icone) {
    icone.className = audioActive
      ? "fa-solid fa-volume-high"
      : "fa-solid fa-volume-xmark";
  }

  if (libelle) {
    libelle.textContent = audioActive ? "Son activé" : "Son désactivé";
  }
}

function basculerAudio() {
  sonsDesactives = !sonsDesactives;
  sauvegarderPreferenceAudio();
  mettreAJourBoutonAudio();
}

function jouerSon(type) {
  if (sonsDesactives) return;

  const son = sons[type];
  if (!son) {
    console.warn(`Son inconnu : ${type}`);
    return;
  }

  son.currentTime = 0;
  son.play().catch(() => {
    // La lecture peut être refusée par le navigateur sans interaction utilisateur.
  });
}

const boutonAudio = document.getElementById("sound-toggle");
boutonAudio?.addEventListener("click", basculerAudio);
mettreAJourBoutonAudio();

// API publique minimale utilisée par passemot.js.
window.jouerSon = jouerSon;
