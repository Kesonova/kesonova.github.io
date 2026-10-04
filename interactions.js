(function initResearchSelection() {
  const button = document.getElementById("research-toggle");
  const heading = document.getElementById("research-heading");
  const status = document.getElementById("research-status");
  const papers = Array.from(document.querySelectorAll("#research-papers .paper-row"));
  if (!button || !heading || papers.length === 0) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const extras = papers.filter(function (paper) { return paper.dataset.highlight !== "true"; });
  const ease = "cubic-bezier(.22, 1, .36, 1)";
  let showAll = false;

  function setLabels() {
    heading.textContent = showAll ? "All Research Papers" : "Highlight Research";
    button.textContent = showAll ? "Highlight Research" : "All Research Papers";
    button.setAttribute("aria-expanded", String(showAll));
    button.setAttribute("aria-label", showAll ? "Show highlighted research only" : "Show all research papers");
  }

  function swapLabels() {
    [heading, button].forEach(function (element) {
      element.classList.remove("is-switching");
      void element.offsetWidth; // Restart the animation on rapid clicks.
      element.classList.add("is-switching");
    });
    window.setTimeout(setLabels, 160);
  }

  function announce() {
    if (!status) return;
    const count = showAll ? papers.length : papers.length - extras.length;
    status.textContent = "Showing " + count + (showAll ? " research papers." : " highlighted papers.");
  }

  // Expand or collapse a paper row by its height, margins and padding, so the rows below glide.
  function animatePaper(paper, entering, delay) {
    paper.getAnimations().forEach(function (animation) { animation.cancel(); });
    paper.hidden = false;
    const style = window.getComputedStyle(paper);
    const open = {
      height: paper.offsetHeight + "px",
      marginTop: style.marginTop, marginBottom: style.marginBottom,
      paddingTop: style.paddingTop, paddingBottom: style.paddingBottom,
      opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)"
    };
    const closed = {
      height: "0px", marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px",
      opacity: 0, transform: "translateY(-10px) scale(.98)", filter: "blur(3px)"
    };
    paper.style.overflow = "hidden";
    const animation = paper.animate(entering ? [closed, open] : [open, closed], {
      duration: entering ? 520 : 380, delay: delay, easing: ease, fill: "backwards"
    });
    animation.onfinish = function () {
      paper.style.overflow = "";
      if (!entering) paper.hidden = true;
    };
    animation.oncancel = function () { paper.style.overflow = ""; };
  }

  button.addEventListener("click", function () {
    showAll = !showAll;
    swapLabels();
    if (reducedMotion.matches || typeof Element.prototype.animate !== "function") {
      extras.forEach(function (paper) { paper.hidden = !showAll; });
    } else {
      extras.forEach(function (paper, index) { animatePaper(paper, showAll, index * 70); });
    }
    announce();
  });

  extras.forEach(function (paper) { paper.hidden = true; });
  setLabels();
  button.hidden = false;
})();

(function initFigurePreview() {
  const dialog = document.getElementById("figure-dialog");
  const image = document.getElementById("figure-image");
  const caption = document.getElementById("figure-caption");
  if (!dialog || typeof dialog.showModal !== "function") return;

  let trigger = null;
  document.querySelectorAll("a[data-figure]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trigger = link;
      image.src = link.href;
      image.alt = link.querySelector("img").alt;
      caption.textContent = link.dataset.caption;
      dialog.showModal();
    });
  });

  dialog.addEventListener("click", function (event) {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom)) {
      dialog.close();
    }
  });

  dialog.addEventListener("close", function () {
    if (trigger) trigger.focus({ preventScroll: true });
  });
})();

(function initBackToTop() {
  const backTop = document.querySelector(".back-top");
  if (!backTop) return;
  let ticking = false;
  function update() {
    backTop.classList.toggle("is-visible", window.scrollY > 480);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  update();
})();
