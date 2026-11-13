/* Science4AI — interactive plate, growth figure, checklist and navigation.
   No dependencies. Everything here is progressive enhancement:
   the guide reads fine without it. */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ───────── viridis ───────── */

  const VIRIDIS = ["#440154", "#482878", "#3e4a89", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"]
    .map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));

  function viridis(t) {
    const x = Math.min(1, Math.max(0, t)) * (VIRIDIS.length - 1);
    const i = Math.min(VIRIDIS.length - 2, Math.floor(x));
    const f = x - i;
    const c = VIRIDIS[i].map((a, k) => Math.round(a + (VIRIDIS[i + 1][k] - a) * f));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  /* Activity is shown on a gently compressed scale so that the bulk of the
     plate (0–1.2 × reference) is not all one color. The color-bar ticks in
     the HTML are placed with the same transform. */
  const MAX_ACTIVITY = 3.3;
  const scale = (v) => Math.pow(Math.min(v, MAX_ACTIVITY) / MAX_ACTIVITY, 0.7);

  /* ───────── the illustrative plate ───────── */

  const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const COLS = 12;

  const HITS = { C7: 2.94, F4: 2.41, B10: 3.27 };
  const FIXED = { E5: 1.08, F5: 0.97 };
  const FAILS = {
    A12: "volume below threshold at read (edge evaporation)",
    H12: "volume below threshold at read (edge evaporation)",
    D6: "liquid-level check failed at dispense",
    G9: "bubble flagged in the optical path",
  };

  const FAMILIES = [
    { upTo: 5, name: "core packing", question: "Does filling the cavity behind the active site hold the catalytic residues in place?" },
    { upTo: 8, name: "pocket entrance", question: "Does widening the pocket entrance let the bulkier substrate in?" },
    { upTo: 10, name: "surface charge", question: "Does removing a charged surface patch keep more of the enzyme soluble, and so more active?" },
    { upTo: 12, name: "lid loop", question: "Does shortening the lid loop speed up product release?" },
  ];

  const KIND_LABEL = {
    hit: "Hit",
    improved: "Improved",
    neutral: "Near reference",
    dead: "Inactive",
    fail: "Failed QC",
    blank: "Control, no-template blank",
    ref: "Control, reference protein",
  };

  function mulberry32(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildWells() {
    const rand = mulberry32(20261112);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const wells = [];

    for (let c = 1; c <= COLS; c++) {
      for (let r = 0; r < ROWS.length; r++) {
        const id = ROWS[r] + c;
        const w = { id, row: r, col: c, i: (c - 1) + r * 0.6 };

        if (c === 1) {
          if (r < 4) { w.kind = "blank"; w.value = 0.02 + rand() * 0.03; w.sample = "no-template blank"; }
          else { w.kind = "ref"; w.value = 0.96 + rand() * 0.08; w.sample = "reference protein"; }
          wells.push(w);
          continue;
        }

        const n = (c - 2) * 8 + r + 1;
        w.sample = "V-" + String(n).padStart(3, "0");
        w.family = FAMILIES.find((f) => c <= f.upTo);
        w.threshold = rand() < 0.55 ? 1.2 : 1.5;
        w.confidence = pick([35, 40, 50, 55, 60, 70]);
        w.cv = 3 + Math.floor(rand() * 7);
        const roll = rand();
        const jitter = rand();

        if (HITS[id]) { w.kind = "hit"; w.value = HITS[id]; w.reported = true; w.threshold = 1.5; w.confidence = 40; }
        else if (FAILS[id]) { w.kind = "fail"; w.value = 0.3 + jitter * 1.2; w.reason = FAILS[id]; }
        else if (FIXED[id]) { w.kind = "neutral"; w.value = FIXED[id]; w.cv = 6; }
        else if (roll < 0.31) { w.kind = "dead"; w.value = 0.03 + jitter * 0.15; }
        else if (roll < 0.44) { w.kind = "improved"; w.value = 1.25 + jitter * 0.5; }
        else { w.kind = "neutral"; w.value = 0.62 + jitter * 0.56; }

        wells.push(w);
      }
    }
    return wells;
  }

  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  };

  function initPlate() {
    const plate = document.getElementById("plate");
    const record = document.getElementById("record");
    const tally = document.getElementById("tally");
    const radios = Array.from(document.querySelectorAll('input[name="view"]'));
    if (!plate || !record) return;

    const wells = buildWells();
    const byId = new Map(wells.map((w) => [w.id, w]));
    const buttons = new Map();
    let view = "published";
    let selected = "C7";

    /* column numbers, then one row at a time: letter + twelve wells */
    plate.append(el("span", { class: "plate-label", "aria-hidden": "true" }));
    for (let c = 1; c <= COLS; c++) plate.append(el("span", { class: "plate-label", "aria-hidden": "true", text: String(c) }));
    ROWS.forEach((letter, r) => {
      plate.append(el("span", { class: "plate-label", "aria-hidden": "true", text: letter }));
      for (let c = 1; c <= COLS; c++) {
        const w = byId.get(letter + c);
        const b = el("button", { class: "well", type: "button", "data-id": w.id, "data-kind": w.kind, "aria-pressed": "false", tabindex: "-1" });
        if (w.reported) b.setAttribute("data-reported", "");
        b.style.setProperty("--c", viridis(scale(w.value)));
        b.style.setProperty("--i", w.i.toFixed(1));
        buttons.set(w.id, b);
        plate.append(b);
      }
    });

    const fmt = (v) => v.toFixed(2);

    function wellLabel(w) {
      if (view === "published") return w.reported ? `Well ${w.id}, reported` : `Well ${w.id}, not reported`;
      return `Well ${w.id}, ${KIND_LABEL[w.kind].toLowerCase()}, ${fmt(w.value)} times reference`;
    }

    function fields(pairs) {
      const dl = el("dl", { class: "fields" });
      for (const [k, v] of pairs) dl.append(el("dt", { text: k }), el("dd", { text: v }));
      return dl;
    }

    function renderRecord() {
      const w = byId.get(selected);
      const head = el("div", { class: "record-head" }, [
        el("h2", { text: "Well " + w.id }),
        el("span", { class: "record-kind", text: view === "published" ? (w.reported ? "Reported" : "Not reported") : KIND_LABEL[w.kind] }),
      ]);
      const out = [head];

      if (view === "published") {
        if (w.reported) {
          out.push(fields([["sample", w.sample], ["activity", w.value.toFixed(1) + "-fold over reference"]]));
          out.push(el("p", { class: "record-empty", text: "That is everything the paper says about this well." }));
        } else if (w.kind === "blank" || w.kind === "ref") {
          out.push(el("p", { class: "record-empty", text: "A control. The methods section says controls were run; their values are not given." }));
        } else {
          out.push(el("p", { class: "record-empty", text: "This well was run and measured, then left out of the paper. Its record exists only in a lab notebook." }));
        }
      } else {
        const isControl = w.kind === "blank" || w.kind === "ref";
        out.push(fields([
          ["sample", w.sample],
          ["activity", fmt(w.value) + " × reference"],
          ["replicates", isControl ? "4 wells on this plate" : `3, CV ${w.cv}%`],
          ["conditions", "30 °C, 4 h, substrate S2 at 50 µM"],
          ["protocol", "cellfree-expr v2.1"],
          ["qc", w.kind === "fail" ? "fail: " + w.reason : "pass"],
        ]));

        const why = el("div", { class: "why" });
        if (w.kind === "blank") {
          why.append(el("p", { text: "Why it was run" }), el("p", { text: "Sets the assay floor for every other well on this plate." }));
        } else if (w.kind === "ref") {
          why.append(el("p", { text: "Why it was run" }), el("p", { text: "Every value on this plate is reported relative to these four wells." }));
        } else {
          /* E5 and F5 are the pair worked through in the "two layers" figure. */
          const paired = w.id === "E5" || w.id === "F5";
          why.append(el("p", { text: paired ? "Does filling the cavity behind the active site make the enzyme more stable without costing activity?" : w.family.question }));
          if (paired) {
            why.append(el("p", { text: "Predicted melting temperature up by at least 2 °C with activity within 20% of reference, 60% confident. Verdict: refuted." }));
          } else if (w.kind === "fail") {
            why.append(el("p", { text: `Predicted at least ${w.threshold} × reference, ${w.confidence}% confident. No verdict: the measurement failed QC. Kept and flagged so that nobody mistakes it for a null.` }));
          } else {
            const verdict = w.value >= w.threshold ? "confirmed" : "refuted";
            let line = `Predicted at least ${w.threshold} × reference, ${w.confidence}% confident. Verdict: ${verdict}.`;
            if (w.kind === "dead") line += " An inactive variant shows a model where the protein does not tolerate change.";
            why.append(el("p", { text: line }));
          }
        }
        out.push(why);
      }
      record.replaceChildren(...out);
    }

    function renderTally() {
      if (!tally) return;
      if (view === "published") {
        tally.replaceChildren(el("b", { text: "3 of 96 wells" }), " reach the paper.");
        return;
      }
      const count = (k) => wells.filter((w) => w.kind === k).length;
      tally.replaceChildren(
        el("b", { text: "96 of 96 wells" }),
        ` are kept: ${count("hit")} hits, ${count("improved")} improved, ${count("neutral")} near reference, ${count("dead")} inactive, ${count("fail")} failed QC and ${count("blank") + count("ref")} controls.`
      );
    }

    function select(id, focus) {
      if (!buttons.has(id)) return;
      buttons.get(selected).setAttribute("aria-pressed", "false");
      buttons.get(selected).tabIndex = -1;
      selected = id;
      const b = buttons.get(id);
      b.setAttribute("aria-pressed", "true");
      b.tabIndex = 0;
      if (focus) b.focus();
      renderRecord();
    }

    function setView(next) {
      view = next;
      plate.dataset.view = next;
      radios.forEach((r) => { r.checked = r.value === next; });
      buttons.forEach((b, id) => b.setAttribute("aria-label", wellLabel(byId.get(id))));
      renderTally();
      renderRecord();
    }

    plate.addEventListener("click", (e) => {
      const b = e.target.closest(".well");
      if (b) select(b.dataset.id, false);
    });
    plate.addEventListener("pointerover", (e) => {
      if (e.pointerType !== "mouse") return;
      const b = e.target.closest(".well");
      if (b && b.dataset.id !== selected) select(b.dataset.id, false);
    });
    plate.addEventListener("keydown", (e) => {
      const w = byId.get(selected);
      let r = w.row, c = w.col;
      if (e.key === "ArrowRight") c = Math.min(COLS, c + 1);
      else if (e.key === "ArrowLeft") c = Math.max(1, c - 1);
      else if (e.key === "ArrowDown") r = Math.min(ROWS.length - 1, r + 1);
      else if (e.key === "ArrowUp") r = Math.max(0, r - 1);
      else if (e.key === "Home") c = 1;
      else if (e.key === "End") c = COLS;
      else return;
      e.preventDefault();
      select(ROWS[r] + c, true);
    });

    /* The one orchestrated moment: the page opens on what a paper keeps,
       then the rest of the plate fills in. It runs once, and never if the
       visitor has already used the control or prefers reduced motion. */
    let autoTimer = null;
    radios.forEach((r) => r.addEventListener("change", () => {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      if (r.checked) setView(r.value);
    }));

    setView("published");
    select("C7", false);

    if (!reduceMotion) {
      autoTimer = setTimeout(() => { autoTimer = null; setView("learnable"); }, 1700);
      const cancel = () => { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } };
      plate.addEventListener("pointerdown", cancel, { once: true });
      plate.addEventListener("keydown", cancel, { once: true });
    }
  }

  /* ───────── PDB growth figure: crosshair and readout ───────── */

  function initChart() {
    const fig = document.getElementById("pdb-chart");
    if (!fig) return;
    const plot = fig.querySelector(".chart-plot");
    const cross = fig.querySelector(".chart-cross");
    const crossDot = fig.querySelector(".chart-cross-dot");
    const tip = fig.querySelector(".chart-tip");
    /* the table under the figure is the single source of the numbers */
    const rows = Array.from(fig.querySelectorAll("tbody tr")).map((tr) => ({
      year: Number(tr.cells[0].textContent),
      value: Number(tr.cells[1].textContent.replace(/,/g, "")),
    }));
    if (!plot || !cross || !tip || !rows.length) return;

    const X0 = 1971, X1 = 2025, YMAX = 300000;
    const first = rows[0].year;
    const last = rows[rows.length - 1].year;
    const byYear = new Map(rows.map((r) => [r.year, r.value]));
    let current = null;

    function show(year) {
      current = Math.min(last, Math.max(first, year));
      const value = byYear.get(current);
      const x = (current - X0) / (X1 - X0);
      cross.hidden = false;
      tip.hidden = false;
      cross.style.left = x * 100 + "%";
      crossDot.style.bottom = (value / YMAX) * 100 + "%";
      tip.querySelector("b").textContent = value.toLocaleString("en-US");
      tip.querySelector("span").textContent = "entries at the end of " + current;
      const width = plot.clientWidth;
      const tipWidth = tip.offsetWidth;
      tip.style.left = Math.min(width - tipWidth, Math.max(0, x * width - tipWidth / 2)) + "px";
    }
    function hide() { current = null; cross.hidden = true; tip.hidden = true; }
    function fromPointer(e) {
      const box = plot.getBoundingClientRect();
      show(Math.round(X0 + ((e.clientX - box.left) / box.width) * (X1 - X0)));
    }

    plot.addEventListener("pointermove", fromPointer);
    plot.addEventListener("pointerdown", fromPointer);
    plot.addEventListener("pointerleave", () => { if (document.activeElement !== plot) hide(); });
    plot.addEventListener("focus", () => { if (current === null) show(last); });
    plot.addEventListener("blur", hide);
    plot.addEventListener("keydown", (e) => {
      const year = current === null ? last : current;
      if (e.key === "ArrowLeft") show(year - 1);
      else if (e.key === "ArrowRight") show(year + 1);
      else if (e.key === "Home") show(first);
      else if (e.key === "End") show(last);
      else return;
      e.preventDefault();
    });
  }

  /* ───────── checklist ───────── */

  function initChecklist() {
    const root = document.getElementById("checks");
    if (!root) return;
    const boxes = Array.from(root.querySelectorAll('input[type="checkbox"]'));
    const fill = document.getElementById("progress-fill");
    const text = document.getElementById("progress-text");
    const copy = document.getElementById("copy-md");
    const reset = document.getElementById("reset-checks");
    const KEY = "science4ai-checklist-v1";

    const load = () => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(KEY) || "[]");
        boxes.forEach((b, i) => { b.checked = Boolean(saved[i]); });
      } catch (err) { /* storage can be unavailable; the checklist still works */ }
    };
    const save = () => {
      try { window.localStorage.setItem(KEY, JSON.stringify(boxes.map((b) => b.checked))); } catch (err) { /* ignore */ }
    };
    const update = () => {
      const done = boxes.filter((b) => b.checked).length;
      if (fill) fill.style.width = (done / boxes.length) * 100 + "%";
      if (text) text.textContent = `${done} of ${boxes.length} checked`;
    };

    const markdown = () => {
      const lines = ["# AI-readiness checklist", "", "From https://science4ai.org/#checklist", ""];
      root.querySelectorAll(".check-group").forEach((group) => {
        lines.push("## " + group.dataset.key);
        group.querySelectorAll(".check").forEach((item) => {
          const box = item.querySelector("input");
          lines.push(`- [${box.checked ? "x" : " "}] ${item.querySelector("span").textContent.trim()}`);
        });
        lines.push("");
      });
      return lines.join("\n");
    };

    const flash = (label) => {
      const original = "Copy as Markdown";
      copy.textContent = label;
      setTimeout(() => { copy.textContent = original; }, 2000);
    };

    root.addEventListener("change", () => { save(); update(); });
    if (reset) reset.addEventListener("click", () => { boxes.forEach((b) => { b.checked = false; }); save(); update(); });
    if (copy) copy.addEventListener("click", async () => {
      const md = markdown();
      try {
        await navigator.clipboard.writeText(md);
        flash("Copied");
      } catch (err) {
        const ta = el("textarea", { class: "visually-hidden" });
        ta.value = md;
        document.body.append(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
        ta.remove();
        flash(ok ? "Copied" : "Copy failed. Select the list and copy it by hand.");
      }
    });

    load();
    update();
  }

  /* ───────── navigation ───────── */

  function initNav() {
    const head = document.querySelector(".site-head");
    const nav = document.getElementById("site-nav");
    const toggle = document.querySelector(".nav-toggle");
    if (!head || !nav) return;

    const onScroll = () => head.classList.toggle("is-stuck", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (toggle) {
      const setOpen = (open) => { nav.classList.toggle("is-open", open); toggle.setAttribute("aria-expanded", String(open)); };
      toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
      nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
    }

    const links = new Map();
    nav.querySelectorAll('a[href^="#"]').forEach((a) => links.set(a.getAttribute("href").slice(1), a));
    const sections = Array.from(links.keys()).map((id) => document.getElementById(id)).filter(Boolean);
    if (!("IntersectionObserver" in window) || !sections.length) return;

    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) visible.add(entry.target.id); else visible.delete(entry.target.id); });
      const current = sections.find((s) => visible.has(s.id));
      links.forEach((a, id) => { if (current && current.id === id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    }, { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach((s) => observer.observe(s));
  }

  const start = () => { initPlate(); initChart(); initChecklist(); initNav(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
