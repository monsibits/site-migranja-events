(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.querySelectorAll("[data-carousel]").forEach(function (root) {
    var track = root.querySelector(".carousel-track");
    var prev = root.querySelector("[data-carousel-prev]");
    var next = root.querySelector("[data-carousel-next]");
    if (!track) {
      return;
    }

    function step(direction) {
      var slide = track.querySelector("img");
      var width = slide ? slide.getBoundingClientRect().width : track.clientWidth;
      var styles = window.getComputedStyle(track);
      var gap = parseFloat(styles.columnGap || styles.gap) || 0;
      track.scrollBy({ left: direction * (width + gap), behavior: "smooth" });
    }

    if (prev) {
      prev.addEventListener("click", function () {
        step(-1);
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        step(1);
      });
    }
  });
})();
