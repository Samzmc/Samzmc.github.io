// Runway progress bar: a line-drawn runway under the navigation with a 787
// that flies along it as the page scrolls. When a section starts, the plane is
// under that section's link; the part already flown is lit. On phones the links
// are replaced by the runway itself: tapping it jumps to the nearest section.
(() => {
  const wrap = document.querySelector(".runway");
  if (!wrap) return;
  const svg = wrap.querySelector(".runway-art");
  const plane = wrap.querySelector(".runway-plane");
  const label = document.querySelector(".nav-current");
  const links = [...document.querySelectorAll(".nav-links a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href")));
  const phone = window.matchMedia("(max-width: 680px)");
  const NS = "http://www.w3.org/2000/svg";

  // Nanjing Lukou (ZSNJ) runway 07/25, 3,600 m x 60 m. Lengths along the
  // runway are to scale; the width is whatever the CSS height is.
  const RWY = { length: 3600, ends: ["07", "25"] };
  // Touchdown zone: a pair every 150 m out to 900 m, aiming point at 400 m.
  const TDZ = [[150, 3], [300, 2], [600, 2], [750, 1], [900, 1]];
  const AIM = { at: 400, length: 60 };

  let W = 0, H = 0, anchors = [], lit = null, ends = [0, 0], home = 0;
  let lastY = window.scrollY, facing = 1;

  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  };

  // Markings for one end, drawn as the left end; the right end is the same
  // group turned 180 degrees. Returns where the centreline starts.
  function drawEnd(g, num) {
    const k = W / RWY.length; // px per metre
    const mid = H / 2;
    const roomy = H >= 16;
    const bar = (x, w, off, t) => {
      el("rect", { x, y: mid - off - t, width: w, height: t }, g);
      el("rect", { x, y: mid + off, width: w, height: t }, g);
    };
    // threshold piano keys: from 6 m, 30 m long
    const kx = Math.max(1.5, 6 * k);
    const kw = Math.max(roomy ? 8 : 7, 30 * k);
    for (let j = 0; j < (roomy ? 4 : 3); j++) bar(kx, kw, 1.1 + j * 1.75, 1);
    // runway designator, painted to read from the approach; the font is set
    // as attributes because CSS rules don't reach the lit <use> copy
    const nx = kx + kw + (roomy ? 6 : 5);
    const t = el("text", {
      transform: `translate(${nx} ${mid}) rotate(90)`,
      "font-size": roomy ? 7.5 : 6.5,
      "font-weight": 600,
      "font-family": "Inter, system-ui, sans-serif",
      "text-anchor": "middle",
      "dominant-baseline": "central",
    }, g);
    t.textContent = num;
    const centreline = nx + (roomy ? 6 : 5);
    // touchdown zone and aiming point, pushed apart only where the real
    // spacing would overlap on a narrow screen
    const inner = roomy ? 2.2 : 1.9, stripe = 1.1, gap = 0.8;
    const tdLen = Math.max(roomy ? 6 : 4, 22.5 * k);
    const aimLen = Math.max(roomy ? 14 : 8, AIM.length * k);
    const aimT = roomy ? 2.6 : 2.2;
    const items = [...TDZ.map(([m, n]) => ({ m, n })), { m: AIM.at, aim: true }].sort((a, b) => a.m - b.m);
    let free = centreline;
    for (const it of items) {
      const len = it.aim ? aimLen : tdLen;
      const x = Math.max(it.m * k, free);
      if (it.aim) bar(x, len, inner, aimT);
      else for (let j = 0; j < Math.min(it.n, roomy ? 3 : 2); j++) bar(x, len, inner + j * (stripe + gap), stripe);
      free = x + len + (roomy ? 4 : 3);
    }
    return centreline;
  }

  function draw() {
    W = wrap.clientWidth;
    H = svg.clientHeight;
    const mid = H / 2;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.textContent = "";
    el("path", { class: "edge", d: `M0.5 0.5H${W - 0.5}V${H - 0.5}H0.5Z` });
    // all paint markings in one group, so the lit copy can reuse them
    const marks = el("g", { id: "runway-marks" }, el("defs", {}));
    const cl = drawEnd(el("g", {}, marks), RWY.ends[0]);
    drawEnd(el("g", { transform: `rotate(180 ${W / 2} ${mid})` }, marks), RWY.ends[1]);
    ends = [cl, W - cl];
    home = plane.offsetWidth / 2 - 2;
    lit = el("rect", { x: 0, y: -2, width: 0, height: H + 4 }, el("clipPath", { id: "runway-lit" }));
    el("use", { href: "#runway-marks", class: "marks" });
    el("use", { href: "#runway-marks", class: "marks lit", "clip-path": "url(#runway-lit)" });
    // centreline: dashed ahead of the plane, solid behind it
    el("line", { class: "centre", x1: cl, y1: mid, x2: W - cl, y2: mid });
    el("line", { class: "centre lit", x1: cl, y1: mid, x2: W - cl, y2: mid, "clip-path": "url(#runway-lit)" });
    // on phones, a tick under the runway for each section
    if (phone.matches) sectionXs().forEach((x) => el("line", { class: "tick", x1: x, y1: H - 0.5, x2: x, y2: H + 4 }));
  }

  // Where each section sits along the runway: under its link on wider
  // screens, evenly spaced on phones.
  function sectionXs() {
    if (!phone.matches) {
      const left = wrap.getBoundingClientRect().left;
      return links.map((a) => {
        const r = a.getBoundingClientRect();
        return r.left + r.width / 2 - left;
      });
    }
    const [a, b] = ends;
    return links.map((_, i) => a + ((i + 1) / links.length) * (b - a));
  }

  function measure() {
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    const xs = sectionXs();
    let pts = sections.map((s, i) => [s.getBoundingClientRect().top + window.scrollY - pad, xs[i]]);
    // Sections near the bottom can't reach the top of the screen: spread them
    // over the last stretch of scrolling so the plane still visits each one.
    const k = pts.findIndex(([y]) => y >= maxY - 1);
    if (k !== -1) {
      const y0 = k > 0 ? pts[k - 1][0] : 0;
      const yN = pts[pts.length - 1][0];
      pts = pts.map(([y, x], i) => (i < k ? [y, x] : [y0 + ((y - y0) * (maxY - y0)) / Math.max(1, yN - y0), x]));
    }
    // at the top of the page the plane waits at the left threshold
    anchors = [[0, home], ...pts];
  }

  function xAt(y) {
    if (y <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
      const [y0, x0] = anchors[i - 1];
      const [y1, x1] = anchors[i];
      if (y <= y1) return x0 + ((x1 - x0) * (y - y0)) / Math.max(1, y1 - y0);
    }
    return anchors[anchors.length - 1][1];
  }

  function update() {
    const y = window.scrollY;
    if (Math.abs(y - lastY) > 2) {
      const dir = y > lastY ? 1 : -1;
      if (dir !== facing) {
        facing = dir;
        plane.classList.toggle("is-back", facing < 0);
      }
      lastY = y;
    }
    const x = xAt(y);
    plane.style.transform = `translate(${x}px, -50%)`;
    lit.setAttribute("width", Math.max(0, x));
    // current section: the last one whose start has been reached
    let cur = -1;
    for (let i = 1; i < anchors.length; i++) if (y >= anchors[i][0] - 2) cur = i - 1;
    links.forEach((a, i) => {
      a.classList.toggle("is-current", i === cur);
      if (i === cur) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
    if (label) label.textContent = cur >= 0 ? links[cur].textContent : "";
  }

  // Tapping or clicking the runway jumps to the nearest section (or the top).
  wrap.addEventListener("click", (e) => {
    const x = e.clientX - wrap.getBoundingClientRect().left;
    const targets = [[home, "#top"], ...sectionXs().map((sx, i) => [sx, links[i].getAttribute("href")])];
    let best = targets[0];
    for (const t of targets) if (Math.abs(t[0] - x) < Math.abs(best[0] - x)) best = t;
    const link = links.find((a) => a.getAttribute("href") === best[1]);
    if (link) link.click();
    else document.querySelector(".nav-name").click();
  });

  let queued = false;
  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  }, { passive: true });

  function layout() {
    draw();
    measure();
    update();
  }

  window.addEventListener("resize", layout);
  window.addEventListener("load", layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  layout();
  wrap.classList.add("is-ready");
})();
