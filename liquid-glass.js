/*!
 * Liquid glass for plain HTML.
 * Ported from liquid-glass-react by Max Rovensky (MIT, https://github.com/rdev/liquid-glass-react),
 * which adapts https://github.com/shuding/liquid-glass. See assets/files/liquid-glass-react-LICENSE.txt.
 *
 * Usage: add `data-liquid-glass` to an element. Optional attributes:
 *   data-lg-elastic="false"     disable the cursor-following stretch
 *   data-lg-refraction="false"  skip the displacement filter (frosted glass only)
 *   data-lg-depth="0.3"         refraction band as a fraction of the shorter side
 *   data-lg-aberration="2"      chromatic aberration intensity
 *   data-lg-elasticity="0.15"   stretch strength (upstream default 0.15; lower for large surfaces)
 */
(function initLiquidGlass() {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ACTIVATION_ZONE = 200;
  const ELASTICITY = 0.15;
  const MAX_MAP_PIXELS = 160000;

  const elements = Array.from(document.querySelectorAll("[data-liquid-glass]"));
  if (elements.length === 0) return;

  // SVG filters inside backdrop-filter only render in Chromium; elsewhere we keep frosted glass.
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  const supportsRefraction = Array.isArray(brands) && brands.some(function (b) { return b.brand === "Chromium"; });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  let defs = null;
  function ensureDefs() {
    if (defs) return defs;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    defs = document.createElementNS(SVG_NS, "defs");
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }

  function smoothStep(a, b, t) {
    t = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function roundedRectSDF(x, y, halfWidth, halfHeight, radius) {
    const qx = Math.abs(x) - halfWidth + radius;
    const qy = Math.abs(y) - halfHeight + radius;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  }

  // Lens map: pixels near the rim sample inward along the SDF normal, the centre stays undistorted.
  // R encodes x displacement, G/B encode y displacement (B is what the filter reads, as in the original).
  function createDisplacementMap(width, height, radius, depth) {
    const factor = Math.min(1, Math.sqrt(MAX_MAP_PIXELS / (width * height)));
    const w = Math.max(2, Math.round(width * factor));
    const h = Math.max(2, Math.round(height * factor));
    const r = Math.min(radius * factor, w / 2, h / 2);
    const band = Math.max(1, Math.min(w, h) * depth);
    const strength = Math.min(w, h) * 0.22;
    const values = new Float32Array(w * h * 2);
    let max = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5 - w / 2;
        const py = y + 0.5 - h / 2;
        const d = roundedRectSDF(px, py, w / 2, h / 2, r);
        let dx = 0;
        let dy = 0;
        if (d < 0 && -d < band) {
          const nx = roundedRectSDF(px + 0.5, py, w / 2, h / 2, r) - roundedRectSDF(px - 0.5, py, w / 2, h / 2, r);
          const ny = roundedRectSDF(px, py + 0.5, w / 2, h / 2, r) - roundedRectSDF(px, py - 0.5, w / 2, h / 2, r);
          const length = Math.hypot(nx, ny) || 1;
          const falloff = 1 - smoothStep(0, 1, -d / band);
          const magnitude = strength * falloff * falloff;
          dx = -(nx / length) * magnitude;
          dy = -(ny / length) * magnitude;
        }
        const i = (y * w + x) * 2;
        values[i] = dx;
        values[i + 1] = dy;
        max = Math.max(max, Math.abs(dx), Math.abs(dy));
      }
    }
    max = Math.max(max, 1);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    const image = context.createImageData(w, h);
    for (let p = 0; p < w * h; p++) {
      const red = (values[p * 2] / max) * 0.5 + 0.5;
      const green = (values[p * 2 + 1] / max) * 0.5 + 0.5;
      image.data[p * 4] = red * 255;
      image.data[p * 4 + 1] = green * 255;
      image.data[p * 4 + 2] = green * 255;
      image.data[p * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    // Map values are normalised to [-max, max] in map pixels; convert the scale back to element pixels.
    return { url: canvas.toDataURL(), scale: (2 * max) / factor };
  }

  function svgElement(name, attributes) {
    const node = document.createElementNS(SVG_NS, name);
    Object.keys(attributes).forEach(function (key) { node.setAttribute(key, attributes[key]); });
    return node;
  }

  // Same chain as liquid-glass-react: per-channel displacement at slightly different scales, screen-blended.
  function buildFilter(id, aberration) {
    const filter = svgElement("filter", {
      id: id, x: "0", y: "0", width: "100%", height: "100%",
      filterUnits: "objectBoundingBox", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB"
    });
    const image = svgElement("feImage", { x: "0", y: "0", width: "1", height: "1", preserveAspectRatio: "none", result: "MAP" });
    filter.appendChild(image);
    const channels = [
      { name: "RED", factor: 1, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" },
      { name: "GREEN", factor: 1 - aberration * 0.05, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" },
      { name: "BLUE", factor: 1 - aberration * 0.1, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" }
    ];
    const displacements = channels.map(function (channel) {
      const displacement = svgElement("feDisplacementMap", {
        in: "SourceGraphic", in2: "MAP", scale: "0",
        xChannelSelector: "R", yChannelSelector: "B", result: channel.name + "_DISPLACED"
      });
      filter.appendChild(displacement);
      filter.appendChild(svgElement("feColorMatrix", {
        in: channel.name + "_DISPLACED", type: "matrix", values: channel.matrix, result: channel.name + "_CHANNEL"
      }));
      return { node: displacement, factor: channel.factor };
    });
    filter.appendChild(svgElement("feBlend", { in: "GREEN_CHANNEL", in2: "BLUE_CHANNEL", mode: "screen", result: "GB" }));
    filter.appendChild(svgElement("feBlend", { in: "RED_CHANNEL", in2: "GB", mode: "screen", result: "RGB" }));
    filter.appendChild(svgElement("feGaussianBlur", { in: "RGB", stdDeviation: String(Math.max(0.1, 0.5 - aberration * 0.1)) }));
    ensureDefs().appendChild(filter);
    return { image: image, displacements: displacements };
  }

  function layer(className) {
    const span = document.createElement("span");
    span.className = "lg-layer " + className;
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  const glasses = elements.map(function (element, index) {
    const glass = {
      element: element,
      elastic: element.dataset.lgElastic !== "false",
      elasticity: element.dataset.lgElasticity ? parseFloat(element.dataset.lgElasticity) : ELASTICITY,
      refraction: supportsRefraction && element.dataset.lgRefraction !== "false",
      depth: parseFloat(element.dataset.lgDepth) || 0.3,
      aberration: element.dataset.lgAberration ? parseFloat(element.dataset.lgAberration) : 2,
      size: { width: 0, height: 0 },
      filter: null
    };

    const warp = layer("lg-warp");
    element.prepend(warp);
    element.append(layer("lg-rim lg-rim--screen"), layer("lg-rim lg-rim--overlay"), layer("lg-shine"));
    element.classList.add("lg");

    if (glass.refraction) {
      const id = "lg-filter-" + index;
      glass.filter = buildFilter(id, glass.aberration);
      // Upstream sets `filter` on the backdrop-filtered layer; in current Chromium that filter only sees the
      // layer's own tint, so the displacement goes into the backdrop-filter chain where its input is the backdrop.
      const backdrop = "url(#" + id + ") blur(var(--lg-blur, 6px)) saturate(var(--lg-saturation, 140%))";
      warp.style.setProperty("-webkit-backdrop-filter", backdrop);
      warp.style.setProperty("backdrop-filter", backdrop);
    }

    element.addEventListener("pointerdown", function () { element.classList.add("lg-active"); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (type) {
      element.addEventListener(type, function () { element.classList.remove("lg-active"); });
    });
    return glass;
  });

  function refreshMap(glass) {
    if (!glass.filter) return;
    const width = glass.element.offsetWidth;
    const height = glass.element.offsetHeight;
    if (width === 0 || height === 0) return;
    if (Math.abs(width - glass.size.width) < 1 && Math.abs(height - glass.size.height) < 1) return;
    glass.size = { width: width, height: height };
    const radius = parseFloat(window.getComputedStyle(glass.element).borderTopLeftRadius) || 0;
    const map = createDisplacementMap(width, height, radius, glass.depth);
    glass.filter.image.setAttribute("href", map.url);
    glass.filter.image.setAttribute("width", String(width));
    glass.filter.image.setAttribute("height", String(height));
    glass.filter.displacements.forEach(function (d) { d.node.setAttribute("scale", String(map.scale * d.factor)); });
  }

  glasses.forEach(refreshMap);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { glasses.forEach(refreshMap); });
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        const glass = glasses.find(function (g) { return g.element === entry.target; });
        if (glass) refreshMap(glass);
      });
    });
    glasses.forEach(function (glass) { if (glass.filter) observer.observe(glass.element); });
  }

  // Pointer tracking drives the rim highlight angle and the elastic stretch, as in the React component.
  let pointer = null;
  let frame = 0;

  function resetGlass(glass) {
    const style = glass.element.style;
    ["--lg-angle", "--lg-stop-a", "--lg-stop-b", "--lg-rim-a", "--lg-rim-b", "--lg-px", "--lg-py", "--lg-tx", "--lg-ty", "--lg-sx", "--lg-sy"]
      .forEach(function (name) { style.removeProperty(name); });
  }

  function update() {
    frame = 0;
    glasses.forEach(function (glass) {
      if (!pointer) { resetGlass(glass); return; }
      const rect = glass.element.getBoundingClientRect();
      if (rect.width === 0) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = pointer.x - centerX;
      const deltaY = pointer.y - centerY;
      const edgeX = Math.max(0, Math.abs(deltaX) - rect.width / 2);
      const edgeY = Math.max(0, Math.abs(deltaY) - rect.height / 2);
      const edgeDistance = Math.hypot(edgeX, edgeY);
      if (edgeDistance > ACTIVATION_ZONE) { resetGlass(glass); return; }

      const fade = 1 - edgeDistance / ACTIVATION_ZONE;
      const offsetX = (deltaX / rect.width) * 100;
      const offsetY = (deltaY / rect.height) * 100;
      const style = glass.element.style;
      style.setProperty("--lg-angle", (135 + offsetX * 1.2).toFixed(1) + "deg");
      style.setProperty("--lg-stop-a", Math.max(10, 33 + offsetY * 0.3).toFixed(1) + "%");
      style.setProperty("--lg-stop-b", Math.min(90, 66 + offsetY * 0.4).toFixed(1) + "%");
      style.setProperty("--lg-rim-a", Math.min(1, 0.32 + Math.abs(offsetX) * 0.008).toFixed(3));
      style.setProperty("--lg-rim-b", Math.min(1, 0.6 + Math.abs(offsetX) * 0.012).toFixed(3));
      // Cursor position inside the element, for surfaces whose shine follows the pointer.
      style.setProperty("--lg-px", Math.max(0, Math.min(100, 50 + offsetX)).toFixed(1) + "%");
      style.setProperty("--lg-py", Math.max(0, Math.min(100, 50 + offsetY)).toFixed(1) + "%");

      if (!glass.elastic || reducedMotion.matches) return;
      const centerDistance = Math.hypot(deltaX, deltaY);
      if (centerDistance === 0) return;
      const nx = Math.abs(deltaX / centerDistance);
      const ny = Math.abs(deltaY / centerDistance);
      const stretch = Math.min(centerDistance / 300, 1) * glass.elasticity * fade;
      style.setProperty("--lg-tx", (deltaX * glass.elasticity * 0.1 * fade).toFixed(2) + "px");
      style.setProperty("--lg-ty", (deltaY * glass.elasticity * 0.1 * fade).toFixed(2) + "px");
      style.setProperty("--lg-sx", Math.max(0.8, 1 + nx * stretch * 0.3 - ny * stretch * 0.15).toFixed(4));
      style.setProperty("--lg-sy", Math.max(0.8, 1 + ny * stretch * 0.3 - nx * stretch * 0.15).toFixed(4));
    });
  }

  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  window.addEventListener("pointermove", function (event) {
    if (event.pointerType !== "mouse" || !finePointer.matches) return;
    pointer = { x: event.clientX, y: event.clientY };
    schedule();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", function () { pointer = null; schedule(); });
  window.addEventListener("blur", function () { pointer = null; schedule(); });
  window.addEventListener("scroll", function () { if (pointer) schedule(); }, { passive: true });
})();
