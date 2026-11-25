(function () {
  if (window.top !== window.self) {
    try {
      window.top.location.replace(window.self.location.href);
    } catch (err) {
      document.documentElement.removeAttribute("style");
      document.body = document.createElement("body");
      document.body.textContent = "This page cannot be shown inside another site.";
    }
  }
})();
