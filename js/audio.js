/* ===========================================================================
   GESTION DES SONS DU JEU
   ---------------------------------------------------------------------------
   Les sons sont désactivés ou activés depuis le bouton #sound-toggle.
   La préférence est conservée dans localStorage entre les sessions.
   =========================================================================== */

const AUDIO_MUTED_STORAGE_KEY = "kinky_tcg_audio_muted";

// Crée un son. Avec precharger = false (preload="none"), le fichier n'est téléchargé
// qu'à la première lecture : inutile de charger au démarrage des sons rarement utilisés.
function creerSon(url, volume, precharger = true) {
  const audio = new Audio();
  audio.preload = precharger ? "auto" : "none";
  audio.src = url;
  audio.volume = volume;
  return audio;
}

const sons = {
  // Sons du jeu : préchargés pour répondre sans délai.
  bonneReponse: creerSon("assets/audio/bonne-reponse.mp3", 0.45),
  erreur: creerSon("assets/audio/erreur.mp3", 0.45),
  felicitation: creerSon("assets/audio/felicitation.mp3", 0.6),

  // Easter eggs : chargés à la demande.
  surprise: creerSon("assets/audio/surprise-mother-fucker.mp3", 0.45, false),
  yamete: creerSon("assets/audio/yamete.mp3", 0.45, false),
  salope: creerSon("assets/audio/salope_ahh.mp3", 0.45, false),
  ara_ara: creerSon("assets/audio/ara-ara.mp3", 0.45, false),
  yandere_laugh: creerSon("assets/audio/yandere_laugh.mp3", 0.45, false)
};

/*
   Table des mots secrets.
   La clé est comparée après normalisation : minuscules et espaces superflus supprimés.
   Pour ajouter un easter egg, ajoutez simplement une entrée ici.
*/
const easterEggs = {
  nique: "surprise",
  stop: "yamete",
  salope: "salope",
  araara: "ara_ara",
  folle: "yandere_laugh"
};

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
      ? "ic ic-volume-high"
      : "ic ic-volume-xmark";
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

function jouerEasterEgg(saisie) {
  const mot = normaliserMotDePasse(saisie);
  const sonAssocie = easterEggs[mot];

  if (!sonAssocie) return false;

  jouerSon(sonAssocie);
  return true;
}

const boutonAudio = document.getElementById("sound-toggle");
boutonAudio?.addEventListener("click", basculerAudio);
mettreAJourBoutonAudio();

// API publique minimale utilisée par passemot.js.
window.jouerSon = jouerSon;
window.jouerEasterEgg = jouerEasterEgg;
