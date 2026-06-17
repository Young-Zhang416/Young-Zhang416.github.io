const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reducedMotion) {
  initRevealEffects();
  initPointerRipples();
  initScrollHeader();
}

function initRevealEffects() {
  const targets = document.querySelectorAll(".hero-copy, .section, .page-header, .post-item, .card, .article h2, .article p, .graph-shell, .activity-panel");
  targets.forEach((target) => target.classList.add("reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  targets.forEach((target) => observer.observe(target));
}

function initPointerRipples() {
  document.addEventListener("pointerdown", (event) => {
    const interactive = event.target.closest("a, button, .card, .post-item, .activity-cell");
    if (!interactive) return;

    const ripple = document.createElement("span");
    ripple.className = "click-ripple";
    ripple.style.left = `${event.clientX}px`;
    ripple.style.top = `${event.clientY}px`;
    document.body.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  });
}

function initScrollHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const update = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}
