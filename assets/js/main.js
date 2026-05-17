/* CID Basements - Main JS */

// ── Mobile navigation toggle ──────────────────────────────────
(function () {
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("nav-menu");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", function () {
    const isOpen = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  // Close menu when a link is clicked (mobile)
  menu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
})();

// ── Font loading ──────────────────────────────────────────────
(function () {
  if (typeof FontFaceObserver !== "undefined") {
    var maitree = new FontFaceObserver("Maitree");
    maitree.load().then(function () {
      document.body.classList.add("js-fontloaded");
    });
  }
})();

// ── PhotoSwipe gallery initialization ─────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  if (!window.PhotoSwipeLightbox) return;

  document.querySelectorAll(".pswp-gallery").forEach(function (gallery) {
    const lightbox = new PhotoSwipeLightbox({
      gallery: gallery,
      children: "a.gallery-item",
      pswpModule: PhotoSwipe,
    });
    lightbox.init();
  });
});

// ── Contact form: lock state to CO ───────────────────────────
(function () {
  if (!window.location.pathname.startsWith("/contact")) return;
  var stateField = document.getElementById("state");
  if (stateField) {
    stateField.value = "CO";
  }
})();
