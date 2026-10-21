/**
 * Connexion : authentification, redirection selon le rôle, mot de passe oublié.
 */

let pwdVisible = false;

function togglePwd() {
  pwdVisible = !pwdVisible;

  const input = document.getElementById("password");
  const icon = document.getElementById("eyeIcon");

  input.type = pwdVisible ? "text" : "password";

  icon.innerHTML = pwdVisible
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>`;
}

/**
 * Le jeton est conservé dans localStorage si l'utilisateur a demandé à être
 * connecté durablement, dans sessionStorage sinon : la session expire alors
 * à la fermeture du navigateur.
 */
function storeSession(data, email, remember) {
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;

  [
    "access_token", "medicare_token", "token_type",
    "user_role", "role", "user_nom", "user_prenom", "medicare_user",
  ].forEach((k) => other.removeItem(k));

  store.setItem("access_token", data.access_token || "");
  store.setItem("medicare_token", data.access_token || "");
  store.setItem("token_type", data.token_type || "bearer");
  store.setItem("user_role", data.role || "");
  store.setItem("role", data.role || "");
  store.setItem("user_nom", data.nom || "");
  store.setItem("user_prenom", data.prenom || "");
  store.setItem(
    "medicare_user",
    JSON.stringify({
      role: data.role || "",
      nom: data.nom || "",
      prenom: data.prenom || "",
      email: email,
    }),
  );
}

async function handleSubmit(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const remember = document.getElementById("remember")?.checked || false;
  const alertBox = document.getElementById("alertBox");

  if (!email || !password) {
    showAlert("Veuillez remplir tous les champs.");
    return;
  }

  if (!email.includes("@")) {
    showAlert("Adresse e-mail invalide.");
    return;
  }

  if (password.length < 8) {
    showAlert("Le mot de passe doit contenir au moins 8 caractères.");
    return;
  }

  const formData = new FormData();
  formData.append("username", email);
  formData.append("password", password);

  const submitBtn = document.querySelector('#loginForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Connexion…";
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert(data.detail || "Identifiants incorrects. Veuillez réessayer.");
      return;
    }

    storeSession(data, email, remember);

    alertBox.classList.remove("show");
    document.getElementById("formView").style.display = "none";

    const successView = document.getElementById("successView");
    successView.classList.add("show");

    setTimeout(() => {
      document.getElementById("progressBar").style.width = "100%";
    }, 50);

    setTimeout(() => {
      window.location.href = homeForRole(data.role);
    }, 900);
  } catch (error) {
    console.error(error);
    showAlert("Erreur serveur. Vérifiez que le backend est lancé.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Se connecter";
    }
  }
}

/* ── Mot de passe oublié ───────────────────────────────────────────────────── */

function openForgotModal() {
  document.getElementById("forgotModal").classList.add("open");
  document.getElementById("forgotEmail").value = document.getElementById("email").value;
  document.getElementById("forgotResult").textContent = "";
}

function closeForgotModal() {
  document.getElementById("forgotModal").classList.remove("open");
}

async function sendResetLink() {
  const email = document.getElementById("forgotEmail").value.trim().toLowerCase();
  const result = document.getElementById("forgotResult");
  const btn = document.getElementById("btnSendReset");

  if (!email.includes("@")) {
    result.textContent = "Adresse e-mail invalide.";
    result.className = "forgot-result error";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Envoi…";

  try {
    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();

    result.textContent =
      data.message ||
      "Si un compte est associé à cette adresse, un e-mail vient d'être envoyé.";
    result.className = "forgot-result ok";
  } catch (error) {
    result.textContent = "Erreur serveur. Réessayez dans quelques instants.";
    result.className = "forgot-result error";
  } finally {
    btn.disabled = false;
    btn.textContent = "Envoyer le lien";
  }
}

/* ── Messages renvoyés par le backend ──────────────────────────────────────── */

function handleQueryMessages() {
  const params = new URLSearchParams(window.location.search);

  const errors = {
    token_invalide: "Ce lien de vérification est invalide ou a expiré.",
    acces_refuse: "Vous n'avez pas accès à cette page.",
    session_expiree: "Votre session a expiré, veuillez vous reconnecter.",
  };

  const error = params.get("error");
  if (error && errors[error]) {
    showAlert(errors[error]);
    return;
  }

  if (params.get("verified") === "1") {
    showAlert("Adresse e-mail confirmée. Vous pouvez vous connecter.", "success");
  } else if (params.get("verified") === "already") {
    showAlert("Cette adresse e-mail était déjà confirmée.", "success");
  } else if (params.get("reset") === "1") {
    showAlert("Mot de passe mis à jour. Vous pouvez vous connecter.", "success");
  }
}

function showAlert(message, type = "error") {
  const box = document.getElementById("alertBox");
  const text = document.getElementById("alertText");

  text.textContent = message;
  box.classList.remove("success");
  if (type === "success") box.classList.add("success");
  box.classList.add("show");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.addEventListener("DOMContentLoaded", () => {
  handleQueryMessages();

  // Un utilisateur déjà connecté n'a rien à faire sur cette page.
  const token =
    localStorage.getItem("medicare_token") || sessionStorage.getItem("medicare_token");
  if (token) {
    try {
      const user = JSON.parse(
        localStorage.getItem("medicare_user") ||
          sessionStorage.getItem("medicare_user") ||
          "{}",
      );
      if (user.role) {
        window.location.replace(homeForRole(user.role));
        return;
      }
    } catch {
      /* session corrompue : on reste sur la page de connexion */
    }
  }

  const year = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = year;
  });
});
