const nav = document.querySelector(".site-nav");
const toggle = document.querySelector(".nav-toggle");

if (toggle && nav) {
  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  };

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    nav.classList.toggle("is-open", !open);
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", close);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduceMotion) {
  const items = document.querySelectorAll(".reveal");
  if (items.length && "IntersectionObserver" in window) {
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
    items.forEach((item) => observer.observe(item));
  } else {
    items.forEach((item) => item.classList.add("is-visible"));
  }
}

const params = new URLSearchParams(window.location.search);
const intent = params.get("intent");
const typeField = document.querySelector("#inquiry-type");
if (typeField && intent) {
  const map = {
    ocular: "Book an ocular visit",
    quote: "Request a quote",
    general: "General inquiry"
  };
  if (map[intent]) typeField.value = map[intent];
}

const lightbox = document.querySelector("[data-lightbox]");
if (lightbox) {
  const items = [...document.querySelectorAll("[data-gallery] a")];
  const image = lightbox.querySelector("[data-lightbox-image]");
  const caption = lightbox.querySelector("[data-lightbox-caption]");
  const closer = lightbox.querySelector("[data-lightbox-close]");
  const prev = lightbox.querySelector("[data-lightbox-prev]");
  const next = lightbox.querySelector("[data-lightbox-next]");
  let index = 0;

  const show = (i) => {
    index = (i + items.length) % items.length;
    const link = items[index];
    const img = link.querySelector("img");
    image.src = link.getAttribute("href");
    image.alt = img ? img.alt : "";
    caption.textContent = img ? img.alt : "";
  };

  const open = (i) => {
    show(i);
    if (typeof lightbox.showModal === "function") lightbox.showModal();
    else lightbox.setAttribute("open", "");
    closer.focus();
  };

  const close = () => {
    if (typeof lightbox.close === "function") lightbox.close();
    else lightbox.removeAttribute("open");
  };

  items.forEach((link, i) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      open(i);
    });
  });

  closer?.addEventListener("click", close);
  prev?.addEventListener("click", () => show(index - 1));
  next?.addEventListener("click", () => show(index + 1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });
  document.addEventListener("keydown", (event) => {
    if (!lightbox.open) return;
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
  });
}
