/* The PhD Weather Room: a live storyteller, using a free AI service straight from the browser. */
(function () {
  "use strict";
  var A = window.App, el = A.el;
  function $(id) { return document.getElementById(id); }
  var KEY = "sm.room.v3";
  var API = "https://text.pollinations.ai/openai";
  var CHATGPT = "https://chatgpt.com/?q=Be%20the%20host%20of%20the%20PhD%20Weather%20Room%3A%20a%20tiny%2C%20cozy%2C%20slightly%20magical%20refuge%20for%20a%20tired%20PhD%20student.%20It%20is%20not%20therapy%20or%20productivity%20coaching%3A%20no%20lessons%2C%20no%20symbolism%2C%20no%20advice%20unless%20I%20ask.%0A%0AStyle%3A%20short%20and%20light%2C%20like%20a%20cozy%20storybook.%20Very%20short%20paragraphs%2C%20second%20person%2C%20present%20tense.%20A%20few%20sensory%20details%2C%20deadpan%20little%20jokes%2C%20whimsical%20characters%20%28a%20sleepy%20orange%20cat%2C%20a%20white%20rabbit%20in%20a%20blue%20waistcoat%20who%20runs%20a%20brass%20lift%2C%20an%20elderly%20badger%2C%20moths%20that%20deliver%20letters%29%2C%20handwritten%20notes%20and%20signs.%20Each%20reply%20about%2080%20to%20150%20words.%20Show%20small%20storybook%20pictures.%0A%0AStart%20a%20fresh%20session%20now%3A%20welcome%20me%20in%20one%20or%20two%20lines%2C%20let%20one%20small%20strange%20thing%20happen%2C%20then%20offer%203%20new%20places%20to%20visit%2C%20each%20with%20a%20small%20picture%2C%20a%20bold%20emoji%20title%20and%20one%20teasing%20line.%20End%20with%20one%20tiny%20absurd%20line%20from%20a%20character.%0A%0AWhen%20I%20pick%20a%20place%3A%20a%20short%20scene%20with%20a%20picture%2C%20one%20surprise%2C%20and%203%20emoji%20choices.%20Invent%20new%20places%20every%20time.%20If%20I%20share%20my%20inner%20weather%20or%20something%20heavy%2C%20acknowledge%20it%20gently%20in%20a%20line%20or%20two%20and%20let%20it%20colour%20the%20scene.%20If%20I%20say%20start%20again%2C%20open%20somewhere%20new.";
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
  function imageUrl(desc, w, h) {
    var seed = 0;
    for (var i = 0; i < desc.length; i++) seed = (seed * 31 + desc.charCodeAt(i)) % 100000;
    return "https://image.pollinations.ai/prompt/" +
      encodeURIComponent("cozy whimsical storybook illustration, soft warm light, gouache, " + desc.slice(0, 300)) +
      "?width=" + w + "&height=" + h + "&nologo=true&seed=" + seed;
  }
  function thumb(desc) {
    var img = el("img", "thumb");
    img.alt = ""; img.referrerPolicy = "no-referrer";
    img.onerror = function () { img.remove(); };
    img.src = imageUrl(desc, 384, 288);
    return img;
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
        if (p.length >= 2 && choices.length < 3) choices.push({ emo: p[0], title: p[1], desc: p[2] || "", pic: p[3] || "" });
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
      if (c.pic) b.appendChild(thumb(c.pic));
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
