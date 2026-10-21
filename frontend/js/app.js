/**
 * Coquille applicative commune à toutes les pages authentifiées.
 *
 * Centralise ce qui était dupliqué (ou codé en dur) dans chaque page :
 * - garde d'authentification et chargement de l'identité réelle via /api/auth/me
 * - affichage du nom et de l'avatar dans la barre de navigation
 * - cloche de notifications branchée sur l'API
 * - déconnexion
 * - mise en évidence du lien de navigation correspondant à la page courante
 */
const App = (() => {
  const ROLE_LABELS = {
    medecin: "Médecin",
    secretariat: "Secrétariat",
    admin: "Administrateur",
    patient: "Patient",
  };
  let me = null;
  let notifications = [];

  // ── Utilitaires ──────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function initials(first, last) {
    const a = String(first || "").trim().charAt(0);
    const b = String(last || "").trim().charAt(0);
    return (a + b).toUpperCase();
  }

  function fmtDateFr(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
    });
  }

  function fmtDateShort(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function fmtRelative(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH} h`;
    const diffJ = Math.floor(diffH / 24);
    if (diffJ === 1) return "Hier";
    if (diffJ < 7) return `Il y a ${diffJ} jours`;
    return fmtDateShort(iso);
  }

  function badgeClass(statut) {
    const map = {
      confirme: "badge-green",
      confirmé: "badge-green",
      en_attente: "badge-gold",
      "en attente": "badge-gold",
      annule: "badge-red",
      annulé: "badge-red",
      termine: "badge-blue",
      terminé: "badge-blue",
      a_traiter: "badge-gold",
      a_classer: "badge-gold",
      imprime: "badge-blue",
      envoye: "badge-green",
      envoyé: "badge-green",
      traite: "badge-green",
      traité: "badge-green",
    };
    return map[String(statut || "").trim().toLowerCase()] || "badge-grey";
  }

  // ── Identité ─────────────────────────────────────────────────────────────

  async function loadMe() {
    const data = await api.get("/api/auth/me");
    me = data;

    // L'identité est stockée à côté du jeton, pour rester cohérente avec
    // la durée de vie de la session.
    const store = readSession("medicare_token") ? localStorage : sessionStorage;

    store.setItem(
      "medicare_user",
      JSON.stringify({
        role: data.role || "",
        nom: data.nom || "",
        prenom: data.prenom || "",
        email: data.email || "",
        id_user: data.id_user,
      }),
    );
    return data;
  }

  function roleLabel(role) {
    return ROLE_LABELS[role] || role || "";
  }

  function displayName() {
    if (!me) return "";
    const prefix = me.role === "medecin" ? "Dr. " : "";
    return `${prefix}${me.prenom || ""} ${me.nom || ""}`.trim();
  }

  function paintIdentity() {
    const nameEl = document.getElementById("user-nav-name");
    const avatarEl = document.getElementById("user-nav-avatar");
    if (nameEl) nameEl.textContent = displayName() || "Utilisateur";
    if (avatarEl) avatarEl.textContent = initials(me?.prenom, me?.nom) || "?";
  }

  // ── Notifications ────────────────────────────────────────────────────────

  async function loadNotifications() {
    try {
      notifications = await api.get("/api/notifications", { limit: 20 });
    } catch {
      notifications = [];
    }
    paintNotificationBadge();
    return notifications;
  }

  function unreadCount() {
    return notifications.filter((n) => !n.is_read).length;
  }

  function paintNotificationBadge() {
    const count = unreadCount();
    const btn = document.querySelector(".notif-btn");
    if (!btn) return;

    btn.classList.toggle("has-unread", count > 0);

    let badge = btn.querySelector(".notif-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "notif-count";
      btn.appendChild(badge);
    }
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.style.display = count > 0 ? "flex" : "none";
  }

  function notificationPanelHtml() {
    if (!notifications.length) {
      return '<div class="notif-empty">Aucune notification</div>';
    }
    return notifications
      .map(
        (n) => `
        <div class="notif-item${n.is_read ? "" : " unread"}" data-id="${n.id_notification}">
          <div class="notif-item-title">${escapeHtml(n.titre)}</div>
          <div class="notif-item-body">${escapeHtml(n.contenu || "")}</div>
          <div class="notif-item-time">${escapeHtml(fmtRelative(n.created_at))}</div>
        </div>`,
      )
      .join("");
  }

  function ensureNotificationPanel() {
    const btn = document.querySelector(".notif-btn");
    if (!btn || document.getElementById("notifPanel")) return;

    const panel = document.createElement("div");
    panel.id = "notifPanel";
    panel.className = "notif-panel";
    panel.innerHTML = `
      <div class="notif-panel-head">
        <span>Notifications</span>
        <button type="button" class="notif-panel-action" id="notifReadAll">Tout marquer comme lu</button>
      </div>
      <div class="notif-panel-list" id="notifPanelList"></div>`;
    btn.parentElement.appendChild(panel);

    panel.querySelector("#notifReadAll").addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await api.post("/api/notifications/read-all");
        await loadNotifications();
        renderNotificationPanel();
      } catch (err) {
        api.notify(err.message, "error");
      }
    });

    panel.addEventListener("click", async (e) => {
      const item = e.target.closest(".notif-item");
      if (!item) return;
      const id = item.dataset.id;
      try {
        await api.patch(`/api/notifications/${id}`, { is_read: true });
        await loadNotifications();
        renderNotificationPanel();
      } catch (err) {
        api.notify(err.message, "error");
      }
    });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!panel.contains(e.target) && e.target !== btn) {
        panel.classList.remove("open");
      }
    });
  }

  function renderNotificationPanel() {
    const list = document.getElementById("notifPanelList");
    if (list) list.innerHTML = notificationPanelHtml();
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function markActiveNav() {
    const page = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".side-nav a, .nav-links a").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("?")[0];
      if (!href || href === "#") return;
      const active = href === page;
      a.classList.toggle("active", active);
      if (a.parentElement && a.parentElement.tagName === "LI") {
        a.parentElement.classList.toggle("active", active);
      }
    });
  }

  /**
   * Adapte la navigation au rôle : lien vers le bon tableau de bord et
   * masquage des entrées réservées au personnel.
   */
  function applyRoleLinks(role) {
    const home = homeForRole(role);
    document.querySelectorAll("[data-dashboard]").forEach((a) => {
      a.setAttribute("href", home);
    });
    if (role === "patient") {
      document.querySelectorAll("[data-staff-only]").forEach((a) => {
        const li = a.closest("li");
        if (li) li.remove();
        else a.remove();
      });
    }
  }

  function wireLogout() {
    document.querySelectorAll("[data-logout], .user-chip").forEach((el) => {
      if (el.dataset.logoutWired) return;
      el.dataset.logoutWired = "1";
      el.addEventListener("click", (e) => {
        if (!el.hasAttribute("data-logout") && !el.classList.contains("user-chip")) return;
        if (el.dataset.confirmLogout !== undefined && !confirm("Se déconnecter ?")) return;
        logout();
      });
    });
  }

  // ── Amorçage ─────────────────────────────────────────────────────────────

  /**
   * @param {object} options
   * @param {Function} options.onReady  appelé avec l'identité une fois chargée
   * @param {string[]} options.roles    rôles autorisés (sinon redirection)
   */
  /**
   * La session est conservée dans localStorage (connexion durable) ou
   * sessionStorage (jusqu'à la fermeture du navigateur) : les deux
   * emplacements doivent être consultés.
   */
  function readSession(key) {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  }

  async function init(options = {}) {
    authGuard();

    if (options.roles && options.roles.length) {
      const raw = readSession("medicare_user");
      let role = "";
      try {
        role = JSON.parse(raw || "{}").role || "";
      } catch {
        role = "";
      }
      if (role && !options.roles.includes(role)) {
        // L'utilisateur est authentifié mais n'a pas accès à cette page :
        // on le renvoie vers son tableau de bord.
        window.location.replace(homeForRole(role));
        return null;
      }
    }

    paintIdentity();
    markActiveNav();
    wireLogout();
    ensureNotificationPanel();

    try {
      await loadMe();
      paintIdentity();
      applyRoleLinks(me?.role || "");
      markActiveNav();
    } catch {
      /* l'API_CLIENT redirige vers /login.html en cas de 401 */
    }

    await loadNotifications();
    renderNotificationPanel();

    if (typeof options.onReady === "function") {
      await options.onReady(me);
    }
    return me;
  }

  return {
    init,
    loadMe,
    loadNotifications,
    renderNotificationPanel,
    get me() {
      return me;
    },
    get notifications() {
      return notifications;
    },
    escapeHtml,
    initials,
    fmtDateFr,
    fmtDateShort,
    fmtTime,
    fmtRelative,
    badgeClass,
    roleLabel,
    displayName,
  };
})();
