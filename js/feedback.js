/*
 * FEEDBACK ANONYME — popup du jeu et page dédiée
 *
 * Les deux formulaires partagent ce script et l’endpoint /api/feedback.
 * Une proposition de niveau ajoute son export JSON en pièce jointe.
 */

(() => {
  const MAX_LEVEL_FILE_BYTES = 512 * 1024;
  const LEVEL_FEEDBACK_TYPE = "Proposition de niveau";
  const modal = document.getElementById("feedback-modal");
  const opener = document.getElementById("feedback-open");
  const closer = document.getElementById("feedback-close");
  const form = document.getElementById("feedback-form");
  const type = document.getElementById("feedback-type");
  const message = document.getElementById("feedback-message");
  const status = document.getElementById("feedback-status");
  const fileField = document.getElementById("feedback-file-field");
  const fileInput = document.getElementById("feedback-file");
  const fileName = document.getElementById("feedback-file-name");
  const fileStatus = document.getElementById("feedback-file-status");
  if (!form || !type || !message || !status) return;

  let lastTrigger = null;

  function setStatus(text, kind = "") {
    status.textContent = text;
    status.className = `feedback-status ${kind}`.trim();
  }

  function setFileStatus(text, kind = "") {
    if (!fileStatus) return;
    fileStatus.textContent = text;
    fileStatus.className = `feedback-file-status ${kind}`.trim();
  }

  function syncFileField() {
    if (!fileField || !fileInput) return;
    const needsFile = type.value === LEVEL_FEEDBACK_TYPE;
    fileField.hidden = !needsFile;
    fileInput.required = needsFile;

    // Ne conservons pas une pièce jointe si l’utilisateur change de motif.
    if (!needsFile) {
      fileInput.value = "";
      if (fileName) fileName.textContent = "";
      setFileStatus("");
    }
  }

  function open() {
    if (!modal) return;
    lastTrigger = opener;
    modal.hidden = false;
    document.body.classList.add("info-modal-open");
    message.focus();
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("info-modal-open");
    lastTrigger?.focus();
  }

  function formatFileSize(bytes) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }

  function validateLevelJson(data) {
    if (!data || typeof data !== "object" || !Array.isArray(data.themes) || data.themes.length !== 1) {
      throw new Error("L’export doit contenir un seul niveau dans themes[].");
    }
    const theme = data.themes[0];
    if (!theme || typeof theme !== "object" || !Array.isArray(theme.cards) || theme.cards.length === 0) {
      throw new Error("Le niveau doit contenir au moins une carte.");
    }
  }

  function encodeBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    // Des blocs évitent de dépasser la limite d’arguments de String.fromCharCode.
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  async function buildPayload() {
    const payload = { type: type.value, message: message.value.trim() };
    if (type.value !== LEVEL_FEEDBACK_TYPE) return payload;

    const file = fileInput?.files?.[0];
    if (!file) throw new Error("Joignez le fichier JSON de votre niveau.");
    if (!file.name.toLowerCase().endsWith(".json")) {
      throw new Error("Le fichier doit porter l’extension .json.");
    }
    if (file.size > MAX_LEVEL_FILE_BYTES) {
      throw new Error("Le fichier dépasse la limite de 512 Ko.");
    }

    const fileText = await file.text();
    let level;
    try {
      level = JSON.parse(fileText);
    } catch {
      throw new Error("Le fichier ne contient pas un JSON valide.");
    }
    validateLevelJson(level);

    payload.levelFile = {
      name: file.name,
      contentBase64: encodeBase64(new TextEncoder().encode(fileText))
    };
    return payload;
  }

  async function submit(event) {
    event.preventDefault();
    const text = message.value.trim();
    if (!text) {
      setStatus("Écrivez un message avant l’envoi.", "is-error");
      message.focus();
      return;
    }

    const submitButton = form.querySelector("button[type=submit]");
    if (submitButton) submitButton.disabled = true;
    setStatus(type.value === LEVEL_FEEDBACK_TYPE ? "Vérification du niveau…" : "Envoi en cours…");
    setFileStatus("");

    try {
      const payload = await buildPayload();
      setStatus("Envoi en cours…");
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        let detail = "";
        try { detail = (await response.json()).error || ""; } catch { /* réponse non JSON */ }
        throw new Error(detail || `HTTP ${response.status}`);
      }
      form.reset();
      syncFileField();
      if (fileName) fileName.textContent = "";
      setFileStatus("");
      setStatus("Merci, votre feedback a bien été envoyé.", "is-success");
    } catch (error) {
      console.error("Envoi du feedback impossible :", error);
      const detail = error instanceof Error ? error.message : "Réessayez dans quelques instants.";
      if (type.value === LEVEL_FEEDBACK_TYPE && /fichier|niveau|JSON|Ko/i.test(detail)) {
        setFileStatus(detail, "is-error");
        fileInput?.focus();
      } else {
        setStatus(`L’envoi a échoué. ${detail}`, "is-error");
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  opener?.addEventListener("click", open);
  closer?.addEventListener("click", close);
  modal?.querySelector("[data-feedback-close]")?.addEventListener("click", close);
  type.addEventListener("change", syncFileField);
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      if (fileName) fileName.textContent = "";
      setFileStatus("");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json")) {
      if (fileName) fileName.textContent = "";
      setFileStatus("Choisissez un fichier avec l’extension .json.", "is-error");
      return;
    }
    if (file.size > MAX_LEVEL_FILE_BYTES) {
      if (fileName) fileName.textContent = "";
      setFileStatus("Le fichier dépasse la limite de 512 Ko.", "is-error");
      return;
    }
    if (fileName) fileName.textContent = `${file.name} · ${formatFileSize(file.size)}`;
    setFileStatus("Le contenu JSON sera vérifié avant l’envoi.");
  });
  form.addEventListener("submit", submit);
  if (modal) {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  }

  syncFileField();
})();
