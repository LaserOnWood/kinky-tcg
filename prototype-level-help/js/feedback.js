/*
 * FEEDBACK ANONYME — prototype de test
 *
 * IMPORTANT : cette URL est volontairement en clair dans ce prototype.
 * Remplacez-la par l'URL du webhook Discord de test avant utilisation.
 * Ne réutilisez pas ce mécanisme tel quel en production : une URL exposée
 * peut être récupérée et utilisée pour envoyer du spam.
 */
const FEEDBACK_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1547026176185344021/X-Oep5Lm1qATTnjv-E3x9o7VitbrQuNQU8vZyVKi_-MjjvwVMKjyWsp0r-6dI3SHUEJe";

(() => {
  const modal = document.getElementById("feedback-modal");
  const opener = document.getElementById("feedback-open");
  const closer = document.getElementById("feedback-close");
  const form = document.getElementById("feedback-form");
  const type = document.getElementById("feedback-type");
  const message = document.getElementById("feedback-message");
  const status = document.getElementById("feedback-status");
  if (!modal || !opener || !closer || !form || !type || !message || !status) return;

  let lastTrigger = null;

  function setStatus(text, kind = "") {
    status.textContent = text;
    status.className = `feedback-status ${kind}`.trim();
  }

  function open() {
    lastTrigger = opener;
    modal.hidden = false;
    document.body.classList.add("info-modal-open");
    message.focus();
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove("info-modal-open");
    lastTrigger?.focus();
  }

  async function submit(event) {
    event.preventDefault();
    const text = message.value.trim();
    if (!text) {
      setStatus("Écrivez un message avant l’envoi.", "is-error");
      message.focus();
      return;
    }
    if (FEEDBACK_DISCORD_WEBHOOK_URL.includes("REMPLACER_PAR_VOTRE_WEBHOOK")) {
      setStatus("Configurez d’abord l’URL du webhook dans js/feedback.js.", "is-error");
      return;
    }

    const submitButton = form.querySelector("button[type=submit]");
    submitButton.disabled = true;
    setStatus("Envoi en cours…");

    const payload = {
      username: "Kinky TCG — Feedback",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "Nouveau feedback anonyme",
        color: 0xff2f7e,
        fields: [
          { name: "Type", value: type.value, inline: true },
          { name: "Message", value: text.slice(0, 1500) }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "Prototype feedback • aucun compte requis" }
      }]
    };

    try {
      const response = await fetch(FEEDBACK_DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      setStatus("Merci, votre feedback a bien été envoyé.", "is-success");
    } catch (error) {
      console.error("Envoi du feedback impossible :", error);
      setStatus("L’envoi a échoué. Vérifiez le webhook ou sa politique CORS.", "is-error");
    } finally {
      submitButton.disabled = false;
    }
  }

  opener.addEventListener("click", open);
  closer.addEventListener("click", close);
  modal.querySelector("[data-feedback-close]")?.addEventListener("click", close);
  form.addEventListener("submit", submit);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });
})();
