/**
 * Correspondance entre un rôle et sa page d'accueil.
 * Partagée par la page de connexion et la coquille applicative.
 */
const RoleHome = {
  medecin: "/index.html",
  secretariat: "/index3.html",
  admin: "/index.html",
  patient: "/index2.html",
};

const ROLE_LABELS = {
  medecin: "Médecin",
  secretariat: "Secrétariat",
  admin: "Administrateur",
  patient: "Patient",
};

function homeForRole(role) {
  return RoleHome[String(role || "").toLowerCase()] || "/index2.html";
}
