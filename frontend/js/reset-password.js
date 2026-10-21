/**
 * Réinitialisation du mot de passe via le jeton reçu par e-mail.
 */

const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

const COLORS = ["#f04438", "#f79009", "#e8a838", "#12b76a"];
const LABELS = ["Très faible", "Faible", "Moyen", "Fort"];

function showFeedback(message, type = "error") {
  const el = document.getElementById("feedback");
  el.textContent = message;
  el.className = `feedback ${type}`;
}

function checkStrength(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  const index = Math.min(Math.floor((score / 5) * 4), 3);
  const fill = document.getElementById("meterFill");
  const label = document.getElementById("strengthLabel");

  fill.style.width = `${((index + 1) / 4) * 100}%`;
  fill.style.background = COLORS[index];
  label.textContent = value ? LABELS[index] : "Entrez un mot de passe";
}

async function handleReset(event) {
  event.preventDefault();

  const pwd = document.getElementById("pwd").value;
  const pwd2 = document.getElementById("pwd2").value;

  if (!token) {
    showFeedback("Ce lien est invalide ou a expiré.");
    return;
  }
  if (pwd.length < 8) {
    showFeedback("Le mot de passe doit contenir au moins 8 caractères.");
    return;
  }
  if (pwd !== pwd2) {
    showFeedback("Les deux mots de passe ne correspondent pas.");
    return;
  }

  try {
    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: pwd }),
    });
    const data = await response.json();

    if (!response.ok) {
      showFeedback(data.detail || "Ce lien est invalide ou a expiré.");
      return;
    }

    showFeedback("Mot de passe mis à jour. Redirection vers la connexion…", "ok");
    setTimeout(() => {
      window.location.href = "login.html?reset=1";
    }, 1500);
  } catch (error) {
    showFeedback("Erreur serveur. Réessayez dans quelques instants.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("pwd").addEventListener("input", (e) => checkStrength(e.target.value));

  if (!token) {
    showFeedback("Ce lien est invalide ou a expiré.");
    document.querySelector("#resetForm button").disabled = true;
    return;
  }

  try {
    const response = await fetch(
      `/api/auth/password-reset/validate?token=${encodeURIComponent(token)}`,
    );
    if (!response.ok) {
      showFeedback("Ce lien est invalide ou a expiré.");
      document.querySelector("#resetForm button").disabled = true;
      return;
    }
    document.getElementById("lead").textContent =
      "Choisissez un nouveau mot de passe d'au moins 8 caractères.";
  } catch {
    showFeedback("Impossible de vérifier le lien pour le moment.");
  }
});
