/* The PhD Weather Room: a live storyteller, using a free AI service straight from the browser. */
(function () {
  "use strict";
  var A = window.App, el = A.el;
  function $(id) { return document.getElementById(id); }
  var KEY = "sm.room.v2";
  var API = "https://text.pollinations.ai/openai";
  var CHATGPT = "https://chatgpt.com/share/6ac8bb3d-8db4-83eb-8f4c-bc5392dc45d8";
  var messages = [];          // { role: "host" | "visitor", text, hidden }
  var busy = false;
  var images = {};            // description -> <img>, so pictures survive re-rendering
  try { messages = JSON.parse(A.store.get(KEY) || "[]"); } catch (e) { messages = []; }
  function save() { A.store.set(KEY, JSON.stringify(messages.slice(-40))); }

  // ---------- tiny safe renderer for the room's markup ----------
  function inline(parent, s) {
    // **bold** and *italic*; everything else is plain text nodes (no HTML is ever injected)
    var re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      var node = el(m[1] != null ? "strong" : "em");
      inline(node, m[1] != null ? m[1] : m[2]);
      parent.appendChild(node);
      last = re.lastIndex;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
  }
  function picture(desc) {
    if (images[desc]) return images[desc];
    var img = el("img");
    var seed = 0;
    for (var i = 0; i < desc.length; i++) seed = (seed * 31 + desc.charCodeAt(i)) % 100000;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.onerror = function () { img.remove(); };
    img.src = "https://image.pollinations.ai/prompt/" +
      encodeURIComponent("cozy whimsical storybook illustration, soft warm light, gouache, " + desc.slice(0, 300)) +
      "?width=768&height=432&nologo=true&seed=" + seed;
    images[desc] = img;
    return img;
  }
  /** Renders host text into `box`; returns the choices found. */
  function render(box, src, streaming) {
    box.innerHTML = "";
    var choices = [], list = null, quote = null;
    var lines = src.split("\n");
    if (streaming) lines.pop();          // last line may be half-written
    lines.forEach(function (raw) {
      var line = raw.trim(), m;
      if (!/^- /.test(line)) list = null;
      if (!/^>/.test(line)) quote = null;
      if (!line) return;
      if ((m = /^\[choice:\s*(.+)\]$/i.exec(line))) {
        var p = m[1].split("|").map(function (x) { return x.trim(); });
        if (p.length >= 2 && choices.length < 3) choices.push({ emo: p[0], title: p[1], desc: p.slice(2).join(" | ") });
        return;
      }
      if ((m = /^\[image:\s*(.+)\]$/i.exec(line))) { box.appendChild(picture(m[1])); return; }
      if (/^\[/.test(line) && /^\[(choice|image)/i.test(line)) return;
      if (/^(---+|\*\*\*+)$/.test(line)) { box.appendChild(el("hr")); return; }
      if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { var h = el(m[1].length === 1 ? "h1" : "h2"); inline(h, m[2]); box.appendChild(h); return; }
      if ((m = /^>\s?(.*)$/.exec(line))) {
        if (!quote) { quote = el("blockquote"); box.appendChild(quote); }
        var qp = el("p"); inline(qp, m[1]); quote.appendChild(qp); return;
      }
      if ((m = /^- (.*)$/.exec(line))) {
        if (!list) { list = el("ul"); box.appendChild(list); }
        var li = el("li"); inline(li, m[1]); list.appendChild(li); return;
      }
      var para = el("p"); inline(para, line); box.appendChild(para);
    });
    return choices;
  }

  function showChoices(choices) {
    var box = $("room-choices");
    box.innerHTML = "";
    choices.forEach(function (c) {
      var b = el("button", "choice");
      b.type = "button";
      b.appendChild(el("span", "emo", c.emo));
      b.appendChild(el("b", null, c.title));
      if (c.desc) b.appendChild(el("span", "d", c.desc));
      b.addEventListener("click", function () { say(c.emo + " " + c.title); });
      box.appendChild(b);
    });
  }
  function drawAll() {
    var log = $("room-log");
    log.innerHTML = "";
    var lastChoices = [];
    messages.forEach(function (m) {
      if (m.hidden) return;
      if (m.role === "host") { var d = el("div", "msg-host"); lastChoices = render(d, m.text, false); log.appendChild(d); }
      else { lastChoices = []; log.appendChild(el("div", "msg-me", m.text)); }
    });
    showChoices(lastChoices);
  }
  function setBusy(b) {
    busy = b;
    $("room-send").disabled = b;
    Array.prototype.forEach.call(document.querySelectorAll(".choice"), function (c) { c.disabled = b; });
  }
  function unavailable(box) {
    box.className = "msg-host";
    box.innerHTML = "";
    box.appendChild(el("p", null, "The door to the Weather Room is stuck just now. 🚪"));
    var p = el("p"), a = el("a", null, "Open the Weather Room in ChatGPT instead");
    a.href = CHATGPT; a.target = "_blank"; a.rel = "noopener noreferrer";
    p.appendChild(a); box.appendChild(p);
  }

  function say(textValue, hidden) {
    if (busy) return;
    messages.push({ role: "visitor", text: textValue, hidden: !!hidden });
    drawAll();
    $("room-choices").innerHTML = "";
    var log = $("room-log");
    var box = el("div", "waiting", "The room is rearranging itself… ☁️");
    log.appendChild(box);
    if (!hidden) box.scrollIntoView({ behavior: "smooth", block: "end" });
    setBusy(true);
    var reply = "";
    // A free, keyless AI service, called straight from the browser so the site needs no server.
    var P = window.ROOM_PROMPT, now = new Date();
    var stamp = "It is " + now.toLocaleDateString("en-GB", { weekday: "long" }) + ", " +
      now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " where the visitor is.\n\n";
    var convo = messages.slice(-24).map(function (m, i) {
      return { role: m.role === "host" ? "assistant" : "user", content: (i === 0 ? stamp : "") + m.text };
    });
    fetch(API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai-fast", stream: true,
        messages: [{ role: "system", content: P.system }].concat(P.examples, convo) })
    }).then(function (res) {
      if (!res.ok || !res.body) throw new Error("unavailable");
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = "", lastDraw = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += dec.decode(r.value, { stream: true });
          var i;
          while ((i = buf.indexOf("\n")) >= 0) {
            var line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (line.indexOf("data:") !== 0) continue;
            var data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              var d = JSON.parse(data).choices[0].delta;
              if (d && d.content) reply += d.content;      // ignore the model's hidden "reasoning"
            } catch (e) { /* partial line */ }
          }
          // Redraw at most a few times a second, so long replies stay smooth on phones.
          var now = Date.now();
          if (reply && now - lastDraw > 250) { lastDraw = now; box.className = "msg-host"; render(box, reply, true); }
          return pump();
        });
      }
      return pump();
    }).then(function () {
      if (!reply.trim()) throw new Error("empty");
      messages.push({ role: "host", text: reply });
      save();
      setBusy(false);
      drawAll();
    }).catch(function () {
      messages.pop();                 // forget the unanswered line so retrying is clean
      setBusy(false);
      unavailable(box);
    });
  }

  $("room-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var t = $("room-text").value.trim();
    if (!t || busy) return;
    $("room-text").value = "";
    say(t);
  });
  $("room-restart").addEventListener("click", function () {
    if (busy) return;
    messages = []; save();
    say("start again", true);
  });
  A.onShow.room = function () {
    if (busy) return;
    if (messages.length) { drawAll(); var l = $("room-log").lastChild; if (l) l.scrollIntoView({ block: "start" }); }
    else say("start again", true);
  };
})();
