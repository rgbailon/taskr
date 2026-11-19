(function () {
  var choice = null;
  try {
    choice = window.localStorage.getItem("tasker.theme.v1");
  } catch (error) {
    choice = null;
  }

  var prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme =
    choice === "light" || choice === "dark" ? choice : prefersDark ? "dark" : "light";

  document.documentElement.dataset.theme = theme;

  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#10161c" : "#f3f6f9");
  }
})();
