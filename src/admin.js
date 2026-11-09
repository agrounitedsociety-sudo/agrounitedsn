import {
  login,
  logout,
  signup,
  getUser,
  handleAuthCallback,
  acceptInvite,
  updateUser,
  requestPasswordRecovery,
} from "@netlify/identity";

const CATEGORIES = {
  irrigation: "Irrigation",
  pompage: "Pompage et solaire",
  outils: "Outils",
  protection: "Pulvérisation et protection",
  pepiniere: "Semences et pépinière",
  stockage: "Récolte et stockage",
  mesure: "Mesure et suivi",
};
const STATUSES = {
  nouvelle: "Nouvelle",
  confirmee: "Confirmée",
  livree: "Livrée",
  annulee: "Annulée",
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtF = (n) => Number(n || 0).toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA";
const fmtDate = (d) => new Date(d).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const errMsg = (e) => {
  const m = (e && e.message) || "";
  if (/invalid_grant|Invalid login|credentials/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if (/not confirmed|confirm/i.test(m)) return "Confirmez d'abord votre adresse e-mail (lien reçu par e-mail).";
  if (/401|denied|not allowed/i.test(m)) return "Cette adresse e-mail n'est pas autorisée.";
  if (/already/i.test(m)) return "Un compte existe déjà avec cette adresse.";
  return m || "Une erreur est survenue. Réessayez.";
};

let tt;
function toast(m) {
  $("toast").textContent = m;
  $("toast").classList.add("on");
  clearTimeout(tt);
  tt = setTimeout(() => $("toast").classList.remove("on"), 2200);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...opts,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    showAuth("login-form");
    throw new Error(data.error || "Session expirée, reconnectez-vous.");
  }
  if (!res.ok) throw new Error(data.error || "Erreur " + res.status);
  return data;
}

// ---------------- Auth ----------------
function showAuth(formId, opts = {}) {
  $("app-view").hidden = true;
  $("auth-view").hidden = false;
  ["login-form", "signup-form", "forgot-form", "password-form"].forEach((id) => ($(id).hidden = id !== formId));
  if (opts.error) $("l-err").textContent = opts.error;
  const first = $(formId).querySelector("input");
  if (first) first.focus();
}
document.querySelectorAll("[data-show]").forEach((b) => b.addEventListener("click", () => showAuth(b.dataset.show)));

async function withBusy(form, fn) {
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await fn();
  } finally {
    btn.disabled = false;
  }
}

$("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  $("l-err").textContent = "";
  const email = $("l-email").value.trim(), pass = $("l-pass").value;
  if (!email || !pass) return ($("l-err").textContent = "Indiquez votre e-mail et votre mot de passe.");
  withBusy(e.target, async () => {
    try {
      await login(email, pass);
      await enterApp();
    } catch (err) {
      $("l-err").textContent = errMsg(err);
    }
  });
});

$("signup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  $("s-err").textContent = $("s-ok").textContent = "";
  const email = $("s-email").value.trim(), pass = $("s-pass").value;
  if (!email || pass.length < 8) return ($("s-err").textContent = "E-mail et mot de passe de 8 caractères minimum requis.");
  withBusy(e.target, async () => {
    try {
      await signup(email, pass);
      const user = await getUser();
      if (user) return enterApp();
      $("s-ok").textContent = "Compte créé. Ouvrez le lien de confirmation reçu par e-mail, puis connectez-vous.";
    } catch (err) {
      $("s-err").textContent = errMsg(err);
    }
  });
});

$("forgot-form").addEventListener("submit", (e) => {
  e.preventDefault();
  $("f-err").textContent = $("f-ok").textContent = "";
  const email = $("f-email").value.trim();
  if (!email) return ($("f-err").textContent = "Indiquez votre e-mail.");
  withBusy(e.target, async () => {
    try {
      await requestPasswordRecovery(email);
      $("f-ok").textContent = "Si un compte existe, un lien vient d'être envoyé.";
    } catch (err) {
      $("f-err").textContent = errMsg(err);
    }
  });
});

let pendingInvite = null;
$("password-form").addEventListener("submit", (e) => {
  e.preventDefault();
  $("n-err").textContent = "";
  const pass = $("n-pass").value;
  if (pass.length < 8) return ($("n-err").textContent = "8 caractères minimum.");
  withBusy(e.target, async () => {
    try {
      if (pendingInvite) {
        await acceptInvite(pendingInvite, pass);
        pendingInvite = null;
      } else {
        await updateUser({ password: pass });
      }
      toast("Mot de passe enregistré");
      await enterApp();
    } catch (err) {
      $("n-err").textContent = errMsg(err);
    }
  });
});

$("logout").addEventListener("click", async () => {
  try {
    await logout();
  } catch {}
  showAuth("login-form");
});

async function enterApp() {
  try {
    const me = await api("/api/admin/me");
    $("who").textContent = me.email || "";
    $("auth-view").hidden = true;
    $("app-view").hidden = false;
    loadOrders();
    loadProducts();
  } catch (err) {
    if (!$("auth-view").hidden && !$("login-form").hidden) $("l-err").textContent = errMsg(err);
    else showAuth("login-form", { error: errMsg(err) });
  }
}

// ---------------- Tabs ----------------
function selectTab(name) {
  ["orders", "products"].forEach((n) => {
    $("tab-" + n).setAttribute("aria-selected", String(n === name));
    $("panel-" + n).hidden = n !== name;
  });
}
$("tab-orders").addEventListener("click", () => selectTab("orders"));
$("tab-products").addEventListener("click", () => selectTab("products"));

// ---------------- Orders ----------------
let ORDERS = [];
let COUNTS = {};
let oFilter = "nouvelle";

async function loadOrders() {
  try {
    const data = await api("/api/admin/orders");
    ORDERS = data.orders || [];
    COUNTS = data.counts || {};
    renderOrders();
  } catch (err) {
    $("orders").innerHTML = `<p class="empty">${esc(errMsg(err))}</p>`;
  }
}
$("o-refresh").addEventListener("click", loadOrders);
$("o-q").addEventListener("input", renderOrders);

function renderStats() {
  const total = Object.values(COUNTS).reduce((s, n) => s + n, 0);
  const tiles = [["", "Toutes", total], ...Object.entries(STATUSES).map(([k, v]) => [k, v, COUNTS[k] || 0])];
  $("stats").innerHTML = tiles
    .map(([k, l, n]) => `<button type="button" class="stat" data-filter="${k}" aria-pressed="${oFilter === k}"><div class="n">${n}</div><div class="l">${esc(l)}</div></button>`)
    .join("");
}
$("stats").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]");
  if (!b) return;
  oFilter = b.dataset.filter;
  renderOrders();
});

const waReply = (o) => {
  let n = String(o.telephone).replace(/[^\d]/g, "");
  if (n.length === 9) n = "221" + n;
  const t = `Bonjour ${o.nom}, ici Agro United au sujet de votre commande ${o.reference}.`;
  return "https://wa.me/" + n + "?text=" + encodeURIComponent(t);
};

function renderOrders() {
  renderStats();
  const q = norm($("o-q").value.trim());
  const list = ORDERS.filter(
    (o) => (!oFilter || o.status === oFilter) && (!q || norm([o.reference, o.nom, o.telephone, o.ville, ...o.items.map((i) => i.nom)].join(" ")).includes(q)),
  );
  $("o-count").textContent = list.length + (list.length > 1 ? " commandes" : " commande");
  if (!list.length) {
    $("orders").innerHTML = `<p class="empty">${ORDERS.length ? "Aucune commande dans cette vue." : "Aucune commande pour l'instant. Elles apparaîtront ici dès qu'un client enverra son panier."}</p>`;
    return;
  }
  $("orders").innerHTML = list
    .map(
      (o) => `
    <article class="order" data-id="${o.id}">
      <div class="head">
        <span class="ref">${esc(o.reference)}</span>
        <span class="pill s-${esc(o.status)}">${esc(STATUSES[o.status] || o.status)}</span>
        <span class="date">${esc(fmtDate(o.createdAt))} · via ${o.canal === "email" ? "e-mail" : "WhatsApp"}</span>
        <span class="total">${o.total ? fmtF(o.total) : "Sur devis"}${o.total && o.surDevis ? " + devis" : ""}</span>
      </div>
      <div class="meta">
        <span><b>${esc(o.nom)}</b></span>
        <span><a href="tel:${esc(o.telephone)}">${esc(o.telephone)}</a> · <a href="${esc(waReply(o))}" target="_blank" rel="noopener">Répondre sur WhatsApp</a></span>
        ${o.ville ? `<span>Ville : <b>${esc(o.ville)}</b></span>` : ""}
        <span>Livraison : <b>${esc(o.livraison)}</b></span>
        <span>Paiement : <b>${esc(o.paiement)}</b></span>
      </div>
      <table><tbody>${o.items
        .map((i) => `<tr><td>${i.quantite} × ${esc(i.nom)} <span style="color:var(--muted)">(${esc(i.unite)} · ${esc(i.vendeur)})</span></td><td class="r">${i.prix ? fmtF(i.prix * i.quantite) : "sur devis"}</td></tr>`)
        .join("")}</tbody></table>
      ${o.message ? `<p class="msg">${esc(o.message)}</p>` : ""}
      <div class="ctrl">
        <div><label for="st-${o.id}">Statut</label><select id="st-${o.id}" data-status="${o.id}">${Object.entries(STATUSES)
          .map(([k, v]) => `<option value="${k}"${k === o.status ? " selected" : ""}>${esc(v)}</option>`)
          .join("")}</select></div>
        <div><label for="nt-${o.id}">Note interne</label><input id="nt-${o.id}" data-note="${o.id}" value="${esc(o.noteAdmin)}" placeholder="Devis envoyé, date de livraison…"></div>
        <button class="btn danger sm" type="button" data-del-order="${o.id}">Supprimer</button>
      </div>
    </article>`,
    )
    .join("");
}

async function patchOrder(id, patch) {
  try {
    const row = await api("/api/admin/orders/" + id, { method: "PATCH", body: JSON.stringify(patch) });
    const i = ORDERS.findIndex((o) => o.id === row.id);
    if (i >= 0) {
      if (ORDERS[i].status !== row.status) {
        COUNTS[ORDERS[i].status] = Math.max(0, (COUNTS[ORDERS[i].status] || 1) - 1);
        COUNTS[row.status] = (COUNTS[row.status] || 0) + 1;
      }
      ORDERS[i] = row;
    }
    toast("Commande mise à jour");
    if (patch.status) renderOrders();
  } catch (err) {
    toast(errMsg(err));
  }
}
$("orders").addEventListener("change", (e) => {
  if (e.target.dataset.status) patchOrder(e.target.dataset.status, { status: e.target.value });
  if (e.target.dataset.note) patchOrder(e.target.dataset.note, { noteAdmin: e.target.value });
});
$("orders").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-del-order]");
  if (!b) return;
  const o = ORDERS.find((x) => String(x.id) === b.dataset.delOrder);
  if (!o || !confirm(`Supprimer définitivement la commande ${o.reference} ?`)) return;
  try {
    await api("/api/admin/orders/" + o.id, { method: "DELETE" });
    ORDERS = ORDERS.filter((x) => x !== o);
    COUNTS[o.status] = Math.max(0, (COUNTS[o.status] || 1) - 1);
    renderOrders();
    toast("Commande supprimée");
  } catch (err) {
    toast(errMsg(err));
  }
});

// ---------------- Products ----------------
let PRODUCTS = [];
let editing = null;
$("f-cat").innerHTML = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");

async function loadProducts() {
  try {
    PRODUCTS = await api("/api/admin/products");
    renderProducts();
  } catch (err) {
    $("products").innerHTML = `<p class="empty">${esc(errMsg(err))}</p>`;
  }
}
$("p-q").addEventListener("input", renderProducts);

function renderProducts() {
  const q = norm($("p-q").value.trim());
  const list = PRODUCTS.filter((p) => !q || norm(p.nom + " " + p.vendeur + " " + (CATEGORIES[p.cat] || "")).includes(q));
  $("p-count").textContent = list.length + " / " + PRODUCTS.length + " produits";
  if (!list.length) {
    $("products").innerHTML = `<p class="empty">Aucun produit.</p>`;
    return;
  }
  $("products").innerHTML = `<table class="products"><thead><tr><th>Produit</th><th class="hide-sm">Catégorie</th><th>Prix</th><th>Stock</th><th class="hide-sm">Boutique</th><th></th></tr></thead><tbody>${list
    .map(
      (p) => `<tr class="${p.active ? "" : "off"}">
      <td><b>${esc(p.nom)}</b><br><span style="color:var(--muted);font-size:13px">${esc(p.unite)} · ${esc(p.vendeur)}</span></td>
      <td class="hide-sm">${esc(CATEGORIES[p.cat] || p.cat)}</td>
      <td class="num">${p.prix ? fmtF(p.prix) : "Sur demande"}</td>
      <td class="num">${p.stock === null ? "—" : p.stock === 0 ? '<span style="color:var(--danger);font-weight:700">Épuisé</span>' : p.stock}</td>
      <td class="hide-sm">${p.active ? "Visible" : "Masqué"}</td>
      <td style="text-align:right"><button class="btn ghost sm" type="button" data-edit="${esc(p.id)}">Modifier</button></td>
    </tr>`,
    )
    .join("")}</tbody></table>`;
}
$("products").addEventListener("click", (e) => {
  const b = e.target.closest("[data-edit]");
  if (b) openProduct(PRODUCTS.find((p) => p.id === b.dataset.edit));
});
$("p-new").addEventListener("click", () => openProduct(null));

function openProduct(p) {
  editing = p;
  $("p-title").textContent = p ? "Modifier le produit" : "Nouveau produit";
  $("f-nom").value = p?.nom || "";
  $("f-cat").value = p?.cat || "irrigation";
  $("f-vendeur").value = p?.vendeur || "Agro United";
  $("f-prix").value = p ? p.prix : 0;
  $("f-unite").value = p?.unite || "pièce";
  $("f-stock").value = p && p.stock !== null ? p.stock : "";
  $("f-position").value = p ? p.position : "";
  $("f-photo").value = p?.photo || "";
  $("f-desc").value = p?.description || "";
  $("f-details").value = (p?.details || []).join("\n");
  $("f-active").checked = p ? p.active : true;
  $("p-delete").hidden = !p;
  $("p-err").textContent = "";
  $("p-dialog").showModal();
  $("f-nom").focus();
}
$("p-cancel").addEventListener("click", () => $("p-dialog").close());

$("p-form").addEventListener("submit", (e) => {
  e.preventDefault();
  $("p-err").textContent = "";
  if (!$("f-nom").value.trim()) return ($("p-err").textContent = "Le nom est obligatoire.");
  const body = {
    nom: $("f-nom").value,
    cat: $("f-cat").value,
    vendeur: $("f-vendeur").value,
    prix: $("f-prix").value || 0,
    unite: $("f-unite").value,
    stock: $("f-stock").value === "" ? null : $("f-stock").value,
    position: $("f-position").value || (editing ? editing.position : 0),
    photo: $("f-photo").value.trim(),
    description: $("f-desc").value,
    details: $("f-details").value,
    active: $("f-active").checked,
  };
  withBusy(e.target, async () => {
    try {
      const row = editing
        ? await api("/api/admin/products/" + encodeURIComponent(editing.id), { method: "PUT", body: JSON.stringify(body) })
        : await api("/api/admin/products", { method: "POST", body: JSON.stringify(body) });
      const i = PRODUCTS.findIndex((p) => p.id === row.id);
      if (i >= 0) PRODUCTS[i] = row;
      else PRODUCTS.push(row);
      PRODUCTS.sort((a, b) => a.position - b.position || a.nom.localeCompare(b.nom));
      renderProducts();
      $("p-dialog").close();
      toast(editing ? "Produit mis à jour" : "Produit ajouté");
    } catch (err) {
      $("p-err").textContent = errMsg(err);
    }
  });
});

$("p-delete").addEventListener("click", async () => {
  if (!editing || !confirm(`Supprimer « ${editing.nom} » ? Pour le retirer temporairement, décochez plutôt « Visible ».`)) return;
  try {
    await api("/api/admin/products/" + encodeURIComponent(editing.id), { method: "DELETE" });
    PRODUCTS = PRODUCTS.filter((p) => p.id !== editing.id);
    renderProducts();
    $("p-dialog").close();
    toast("Produit supprimé");
  } catch (err) {
    $("p-err").textContent = errMsg(err);
  }
});

// ---------------- Boot ----------------
(async function boot() {
  try {
    const result = await handleAuthCallback();
    if (result) history.replaceState(null, "", location.pathname);
    if (result?.type === "invite" && result.token) {
      pendingInvite = result.token;
      $("pw-sub").textContent = "Bienvenue ! Choisissez un mot de passe pour activer votre compte.";
      return showAuth("password-form");
    }
    if (result?.type === "recovery") {
      $("pw-sub").textContent = "Choisissez votre nouveau mot de passe.";
      return showAuth("password-form");
    }
  } catch (err) {
    history.replaceState(null, "", location.pathname);
    return showAuth("login-form", { error: "Lien invalide ou expiré. " + errMsg(err) });
  }
  let user = null;
  try {
    user = await getUser();
  } catch {}
  if (user) enterApp();
  else showAuth("login-form");
})();
