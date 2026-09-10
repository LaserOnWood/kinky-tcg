/*
 * FEEDBACK ANONYME — prototype de test
 *
 * L'envoi passe par /api/feedback afin que le webhook Discord reste côté
 * serveur dans la variable d'environnement Vercel
 * FEEDBACK_DISCORD_WEBHOOK_URL.
 */

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

    const submitButton = form.querySelector("button[type=submit]");
    submitButton.disabled = true;
    setStatus("Envoi en cours…");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type.value,
          message: text
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      setStatus("Merci, votre feedback a bien été envoyé.", "is-success");
    } catch (error) {
      console.error("Envoi du feedback impossible :", error);
      setStatus("L’envoi a échoué. Réessayez dans quelques instants.", "is-error");
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
