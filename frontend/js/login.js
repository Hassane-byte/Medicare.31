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

async function handleSubmit(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
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

  try {
    // Use the new API client with FormData
    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert(data.detail || "Identifiants incorrects. Veuillez réessayer.");
      return;
    }

    localStorage.setItem("access_token", data.access_token || "");
    localStorage.setItem("medicare_token", data.access_token || "");
    localStorage.setItem("token_type", data.token_type || "bearer");

    localStorage.setItem("user_role", data.role || "");
    localStorage.setItem("role", data.role || "");
    localStorage.setItem("user_nom", data.nom || "");
    localStorage.setItem("user_prenom", data.prenom || "");

    localStorage.setItem(
      "medicare_user",
      JSON.stringify({
        role: data.role || "",
        nom: data.nom || "",
        prenom: data.prenom || "",
        email: email,
      }),
    );

    alertBox.classList.remove("show");
    document.getElementById("formView").style.display = "none";

    const successView = document.getElementById("successView");
    successView.classList.add("show");

    setTimeout(() => {
      document.getElementById("progressBar").style.width = "100%";
    }, 50);

    setTimeout(() => {
      redirectUser(data.role, email);
    }, 1000);
  } catch (error) {
    console.error(error);
    showAlert("Erreur serveur. Vérifiez que le backend est lancé.");
  }
}

function redirectUser(role, email) {
  const finalRole = (role || "").toLowerCase();

  if (
    finalRole === "doctor" ||
    finalRole === "medecin" ||
    email.startsWith("dr.")
  ) {
    window.location.href = "index.html";
    return;
  }

  if (
    finalRole === "secretaria" ||
    finalRole === "secretariat" ||
    email.startsWith("sec.")
  ) {
    window.location.href = "index3.html";
    return;
  }

  window.location.href = "index2.html";
}

function showAlert(message) {
  const box = document.getElementById("alertBox");
  const text = document.getElementById("alertText");

  text.textContent = message;
  box.classList.add("show");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
