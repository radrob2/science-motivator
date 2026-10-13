/* Home, breathing, writing starter and true stories. The Weather Room lives in room.js. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function qsa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function text(node, t) { if (node) node.textContent = t; }
  function setSegmented(id, attr, value) {
    qsa("#" + id + " [role=radio]").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute(attr) === value)); });
  }
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  // ---------- navigation ----------
  var current = "home";
  var onShow = {};
  function show(name) {
    if (current === "breathe" && name !== "breathe") stopBreath();
    if (current === "writing" && name !== "writing") stopWritingTimer();
    if (current === "story" && name !== "story" && window.App.stopListening) window.App.stopListening();
    current = name;
    qsa(".screen").forEach(function (s) { s.hidden = s.getAttribute("data-screen") !== name; });
    window.scrollTo(0, 0);
    if (onShow[name]) onShow[name]();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-go]") : null;
    if (b) show(b.getAttribute("data-go"));
  });
  window.App = { show: show, onShow: onShow, el: el, store: store };

  // ---------- breathing & grounding (unchanged from the first version) ----------
  var GROUNDING = [
    "Name 5 things you can see around you.",
    "Name 4 things you can physically feel, like your feet on the floor.",
    "Name 3 things you can hear.",
    "Name 2 things you can smell, or two smells you like.",
    "Name 1 thing you can taste, or take one slow sip of water."
  ];
  var BREATH_PATTERNS = [
    { id: "long-out", label: "Calm", detail: "In 4 · out 6 · no holds",
      phases: [{ cue: "Breathe in", s: 4, size: "big" }, { cue: "Breathe out", s: 6, size: "small" }] },
    { id: "even", label: "Even", detail: "In 5 · out 5 · no holds",
      phases: [{ cue: "Breathe in", s: 5, size: "big" }, { cue: "Breathe out", s: 5, size: "small" }] },
    { id: "pause", label: "With pauses", detail: "In 4 · pause 3 · out 4 · pause 3",
      phases: [{ cue: "Breathe in", s: 4, size: "big" }, { cue: "Pause", s: 3, size: "big" },
               { cue: "Breathe out", s: 4, size: "small" }, { cue: "Pause", s: 3, size: "small" }] }
  ];
  var patternId = "long-out";
  var breath = { timer: null, phase: 0, second: 0, cycle: 0, cycles: 0, minutes: 1 };
  function reducedMotion() {
    try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  function currentPattern() { return BREATH_PATTERNS.filter(function (p) { return p.id === patternId; })[0] || BREATH_PATTERNS[0]; }
  function breathCycles(p) {
    var secs = p.phases.reduce(function (a, ph) { return a + ph.s; }, 0);
    return Math.max(1, Math.round(60 / secs));
  }
  function renderBreathPatterns() {
    var box = $("breath-pattern");
    box.innerHTML = "";
    BREATH_PATTERNS.forEach(function (p) {
      var b = el("button", null, p.label);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("data-pattern", p.id);
      b.setAttribute("aria-checked", String(p.id === patternId));
      b.addEventListener("click", function () { patternId = p.id; setSegmented("breath-pattern", "data-pattern", p.id); resetBreath(); });
      box.appendChild(b);
    });
  }
  function resetBreath() {
    stopBreath();
    text($("breath-cue"), "One minute.");
    text($("breath-count"), "");
    $("breath-more").hidden = true;
  }
  function startBreath(minutes) {
    stopBreath();
    var p = currentPattern();
    breath.minutes = minutes || 1;
    breath.cycles = breathCycles(p);
    breath.cycle = 1; breath.phase = 0; breath.second = p.phases[0].s;
    $("breath-start").hidden = true;
    $("breath-more").hidden = true;
    $("breath-stop").hidden = false;
    renderBreath();
    breath.timer = setInterval(tickBreath, 1000);
  }
  function tickBreath() {
    var p = currentPattern();
    breath.second--;
    if (breath.second <= 0) {
      breath.phase++;
      if (breath.phase >= p.phases.length) {
        if (breath.cycle >= breath.cycles) { finishBreath(); return; }
        breath.cycle++; breath.phase = 0;
      }
      breath.second = p.phases[breath.phase].s;
    }
    renderBreath();
  }
  function renderBreath() {
    var ph = currentPattern().phases[breath.phase];
    var circle = $("breath-circle");
    circle.className = "breath-circle " + (ph.size === "big" ? "is-in" : "is-out") + (reducedMotion() ? " still" : "");
    circle.style.transitionDuration = ph.s + "s";
    text($("breath-cue"), ph.cue + " … " + breath.second);
    text($("breath-count"), breath.cycle + " of " + breath.cycles);
  }
  function finishBreath() {
    stopBreath();
    text($("breath-cue"), "Done. Nice.");
    text($("breath-count"), "");
    $("breath-more").hidden = breath.minutes >= 5;
  }
  function stopBreath() {
    if (breath.timer) clearInterval(breath.timer);
    breath.timer = null;
    $("breath-circle").className = "breath-circle";
    $("breath-start").hidden = false;
    $("breath-stop").hidden = true;
  }
  var groundI = 0;
  function renderGround() {
    var done = groundI >= GROUNDING.length;
    text($("ground-step"), done ? "Done. Nice." : GROUNDING[groundI]);
    text($("ground-count"), done ? "" : "Step " + (groundI + 1) + " of " + GROUNDING.length);
    $("ground-next").textContent = done ? "Start again" : (groundI === GROUNDING.length - 1 ? "Finish" : "Next");
  }
  function setPauseMode(mode) {
    setSegmented("pause-mode", "data-mode", mode);
    $("breath-box").hidden = mode === "ground";
    $("ground-box").hidden = mode !== "ground";
    if (mode === "ground") { stopBreath(); groundI = 0; renderGround(); } else resetBreath();
  }
  qsa("#pause-mode [role=radio]").forEach(function (b) { b.addEventListener("click", function () { setPauseMode(b.getAttribute("data-mode")); }); });
  $("breath-start").addEventListener("click", function () { startBreath(1); });
  $("breath-more").addEventListener("click", function () { startBreath(breath.minutes + 1); });
  $("breath-stop").addEventListener("click", function () { stopBreath(); text($("breath-cue"), "Stopped. That's fine."); text($("breath-count"), ""); });
  $("ground-next").addEventListener("click", function () { groundI = groundI >= GROUNDING.length ? 0 : groundI + 1; renderGround(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && breath.timer) $("breath-stop").click(); });
  onShow.breathe = function () { renderBreathPatterns(); setPauseMode("breath"); };

  // ---------- writing starter ----------
  var WRITING = [
    { id: "anything", label: "Anything", starters: [
      "The thing I keep wanting to say is…", "What I actually did this week was…",
      "If I explained this to a friend, I would start with…", "The part I understand best is…",
      "Right now, the honest state of this work is…" ] },
    { id: "intro", label: "Introduction", starters: [
      "This matters because…", "We still don't know…", "Previous work has shown…, but…",
      "In this chapter I ask whether…", "A simple way to picture the problem is…" ] },
    { id: "methods", label: "Methods", starters: [
      "To answer this, I…", "Samples were collected from…", "The first step was to…",
      "I chose this approach because…", "Data were analysed using…" ] },
    { id: "results", label: "Results", starters: [
      "The main thing I found was…", "Compared with…, the … was…", "Figure 1 shows…",
      "Unexpectedly,…", "This did not work in the way I expected:…" ] },
    { id: "discussion", label: "Discussion", starters: [
      "One way to read this result is…", "This fits with…, but differs from…", "A limitation of this work is…",
      "If I had another year, I would test…", "What this changes for the field is…" ] },
    { id: "email", label: "Email to supervisor", starters: [
      "Quick update: I tried … and found …", "I'm stuck on … and would value ten minutes to talk.",
      "Here is where I am, honestly:…", "Could we look at … together this week?",
      "I'd like to suggest a small change of plan:…" ] }
  ];
  var DRAFT_KEY = "sm.draft.v1";
  var wKind = "anything", wOffset = 0, wTimer = { id: null, left: 0 };
  function renderWritingKinds() {
    var box = $("writing-kind");
    box.innerHTML = "";
    WRITING.forEach(function (w) {
      var b = el("button", "chip", w.label);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(w.id === wKind));
      b.addEventListener("click", function () { wKind = w.id; wOffset = 0; renderWritingKinds(); renderStarters(); });
      box.appendChild(b);
    });
  }
  function renderStarters() {
    var sec = WRITING.filter(function (s) { return s.id === wKind; })[0];
    var ul = $("writing-starters");
    ul.innerHTML = "";
    for (var i = 0; i < 3; i++) (function (st) {
      var li = el("li"), b = el("button", "starter", st);
      b.type = "button";
      b.addEventListener("click", function () {
        var t = $("writing-text"), base = t.value.replace(/\s+$/, "");
        t.value = (base ? base + "\n\n" : "") + st.replace(/…$/, " ");
        store.set(DRAFT_KEY, t.value);
        t.focus();
      });
      li.appendChild(b); ul.appendChild(li);
    })(sec.starters[(wOffset * 3 + i) % sec.starters.length]);
  }
  function stopWritingTimer() {
    if (wTimer.id) clearInterval(wTimer.id);
    wTimer.id = null;
    $("writing-timer").textContent = "5-minute timer";
  }
  $("writing-timer").addEventListener("click", function () {
    if (wTimer.id) { stopWritingTimer(); text($("writing-time"), "Stopped. That counts."); return; }
    wTimer.left = 300;
    $("writing-timer").textContent = "Stop timer";
    var showT = function () { text($("writing-time"), Math.floor(wTimer.left / 60) + ":" + ("0" + (wTimer.left % 60)).slice(-2)); };
    showT();
    wTimer.id = setInterval(function () {
      wTimer.left--;
      if (wTimer.left <= 0) { stopWritingTimer(); text($("writing-time"), "Five minutes done. You can stop here."); return; }
      showT();
    }, 1000);
  });
  // "Start over" clears the box. Two taps, so a slip of the finger can't erase a draft.
  var clearArmed = null;
  function disarmClear() { if (clearArmed) clearTimeout(clearArmed); clearArmed = null; $("writing-clear").textContent = "Start over"; }
  $("writing-clear").addEventListener("click", function () {
    var t = $("writing-text");
    if (!t.value) { t.focus(); return; }
    if (!clearArmed) {
      $("writing-clear").textContent = "Tap again to clear";
      clearArmed = setTimeout(disarmClear, 4000);
      return;
    }
    disarmClear();
    t.value = "";
    store.set(DRAFT_KEY, "");
    text($("writing-time"), "");
    t.focus();
  });
  $("writing-more").addEventListener("click", function () { wOffset++; renderStarters(); });
  $("writing-text").addEventListener("input", function () { store.set(DRAFT_KEY, $("writing-text").value); });
  $("writing-copy").addEventListener("click", function () {
    var t = $("writing-text");
    var done = function (ok) { text($("writing-time"), ok ? "Copied." : "Select the text and copy it with your keyboard."); };
    try { navigator.clipboard.writeText(t.value).then(function () { done(true); }, function () { t.select(); done(false); }); }
    catch (e) { t.select(); done(false); }
  });
  onShow.writing = function () {
    if (!$("writing-text").value) $("writing-text").value = store.get(DRAFT_KEY) || "";
    renderWritingKinds(); renderStarters();
  };

  // ---------- true stories ----------
  var STAGES = { "student": "As a student", "early-career": "Early career", "mid-career": "Mid-career", "senior": "Senior researcher", "outside-academia": "Outside academia" };
  var SEEN_KEY = "sm.seen.v1";
  var stories = [], pick = "any", seen = [];
  try { seen = JSON.parse(store.get(SEEN_KEY) || "[]"); } catch (e) { seen = []; }
  function loadStories() {
    // Fetched fresh each time, so newly added stories show up without a restart.
    return fetch("stories/stories.json", { cache: "no-store" }).then(function (r) { return r.json(); })
      .then(function (list) { stories = list.filter(function (s) { return s.kind === "real"; }); })
      .then(function () { return fetch("audio/index.json", { cache: "no-store" }); })
      .then(function (r) { return r.ok ? r.json() : { ids: [] }; })
      .then(function (idx) { narrated = idx.ids || []; }, function () { narrated = []; });
  }
  function pool() {
    return stories.filter(function (s) {
      return pick === "any" || (pick === "phd" ? s.stage === "student" : s.stage !== "student");
    });
  }
  function nextStory() {
    var all = pool();
    if (!all.length) return;
    var fresh = all.filter(function (s) { return seen.indexOf(s.id) === -1; });
    if (!fresh.length) {           // read them all: start the round again
      var ids = all.map(function (s) { return s.id; });
      seen = seen.filter(function (id) { return ids.indexOf(id) === -1; });
      fresh = all;
    }
    // Stories with a recorded narrator come up first.
    var voiced = fresh.filter(function (x) { return narrated.indexOf(x.id) !== -1; });
    if (voiced.length) fresh = voiced;
    var s = fresh[Math.floor(Math.random() * fresh.length)];
    stopListening();
    currentStory = s.id;
    $("story-listen").hidden = narrated.indexOf(s.id) === -1;
    $("story-next").className = $("story-listen").hidden ? "btn primary big" : "btn";
    seen.push(s.id);
    store.set(SEEN_KEY, JSON.stringify(seen.slice(-1000)));
    text($("story-meta"), [s.field !== "unknown" ? s.field : null, s.country && s.country !== "unknown" ? s.country : null, STAGES[s.stage]].filter(Boolean).join(" · "));
    text($("story-name"), s.name);
    text($("story-setback"), s.setback);
    text($("story-after"), s.after);
    text($("story-reflection"), s.reflection || "");
    $("story-reflection").hidden = !s.reflection;
    var ul = $("story-sources");
    ul.innerHTML = "";
    (s.sources || []).forEach(function (src) {
      var li = el("li"), a = el("a", null, src.label || src.url);
      if (/^https:\/\//.test(src.url)) { a.href = src.url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
      li.appendChild(a);
      if (src.publisher) li.appendChild(document.createTextNode(" · " + src.publisher));
      ul.appendChild(li);
    });
    show("story");
  }
  // Read aloud by one narrator. The recordings are plain files in audio/, made by scripts/narrate.js.
  var narrated = [], currentStory = null, audio = null;
  function stopListening() {
    if (audio) { audio.pause(); audio = null; }
    $("story-listen").textContent = "🔊 Listen";
  }
  $("story-listen").addEventListener("click", function () {
    if (audio) { stopListening(); return; }
    var a = new Audio("audio/" + encodeURIComponent(currentStory) + ".mp3");
    audio = a;
    $("story-listen").textContent = "⏹ Stop";
    a.addEventListener("ended", function () { if (audio === a) stopListening(); });
    a.addEventListener("error", function () { if (audio === a) stopListening(); });
    a.play().catch(function () { if (audio === a) stopListening(); });
  });
  window.App.stopListening = stopListening;
  qsa("[data-pick]").forEach(function (b) {
    b.addEventListener("click", function () { pick = b.getAttribute("data-pick"); loadStories().then(nextStory); });
  });
  $("story-next").addEventListener("click", function () { loadStories().then(nextStory); });
})();
