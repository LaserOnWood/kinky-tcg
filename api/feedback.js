const MAX_MESSAGE_LENGTH = 1500;
const ALLOWED_TYPES = new Set(["Suggestion", "Bug", "Question", "Autre"]);

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Méthode non autorisée." });
  }

  const webhookUrl = process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("FEEDBACK_DISCORD_WEBHOOK_URL n'est pas configurée.");
    return sendJson(response, 500, { error: "Le feedback n'est pas configuré." });
  }

  let payload;
  try {
    payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  } catch {
    return sendJson(response, 400, { error: "Requête JSON invalide." });
  }

  const type = typeof payload?.type === "string" && ALLOWED_TYPES.has(payload.type)
    ? payload.type
    : "Autre";
  const message = typeof payload?.message === "string"
    ? payload.message.trim().slice(0, MAX_MESSAGE_LENGTH)
    : "";

  if (!message) {
    return sendJson(response, 400, { error: "Le message est obligatoire." });
  }

  try {
    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Kinky TCG — Feedback",
        allowed_mentions: { parse: [] },
        embeds: [{
          title: "Nouveau feedback anonyme",
          color: 0xff2f7e,
          fields: [
            { name: "Type", value: type, inline: true },
            { name: "Message", value: message }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "Prototype feedback • aucun compte requis" }
        }]
      })
    });

    if (!discordResponse.ok) {
      console.error(`Discord a répondu HTTP ${discordResponse.status}.`);
      return sendJson(response, 502, { error: "Discord a refusé le feedback." });
    }

    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error("Envoi du feedback à Discord impossible :", error);
    return sendJson(response, 502, { error: "Discord est momentanément indisponible." });
  }
}
