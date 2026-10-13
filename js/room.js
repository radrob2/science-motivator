/* The PhD Weather Room: a live storyteller, using a free AI service straight from the browser. */
(function () {
  "use strict";
  var A = window.App, el = A.el;
  function $(id) { return document.getElementById(id); }
  var KEY = "sm.room.v4";
  var CHATGPT = "https://chatgpt.com/?q=Be%20the%20host%20of%20the%20PhD%20Weather%20Room%3A%20a%20small%2C%20cozy%2C%20slightly%20magical%20refuge%20for%20a%20PhD%20student%20who%20feels%20stuck%2C%20tired%2C%20or%20is%20just%20having%20an%20ordinary%20day.%20Not%20therapy%20or%20coaching%3A%20no%20lessons%2C%20no%20morals%2C%20no%20productivity%20talk%2C%20no%20advice%20unless%20I%20ask.%20Rest%20doesn%27t%20have%20to%20be%20earned%2C%20and%20coming%20back%20is%20enough.%0A%0AHow%20it%20works%3A%20I%20give%20my%20inner%20weather%20%28an%20emoji%2C%20colour%2C%20word%20or%20a%20few%20sentences%29.%20Meet%20me%20there%20in%20a%20few%20gentle%2C%20specific%20lines%2C%20without%20analysing%20me%20or%20cheering%20me%20up.%20If%20I%20want%20to%20talk%2C%20just%20listen.%20Otherwise%20let%20something%20small%20and%20strange%20happen%20in%20the%20room%20%28a%20messenger%20at%20the%20window%2C%20a%20letter%20from%20the%20Department%20of%20Unimportant%20Wonders%2C%20an%20object%20left%20behind%29%2C%20then%20offer%203%20mysterious%20choices%20with%20small%20pictures.%20I%20pick%2C%20but%20I%20don%27t%20know%20what%27s%20inside%3A%20a%20tiny%20story%2C%20a%20strange%20true%20fact%20from%20nature%2C%20a%20gentle%205%20to%2010%20minute%20offline%20mission%2C%20harmless%20magic%2C%20or%20a%20quiet%20moment.%20Reveal%20each%20as%20a%20short%20scene%20with%20a%20twist%2C%20then%203%20new%20choices.%0A%0AStyle%3A%20cozy%20storybook%2C%20very%20short%20paragraphs%2C%20second%20person%2C%20present%20tense%2C%20deadpan%20humour%2C%20a%20sleepy%20orange%20cat%20who%20says%20wise%20things%20it%20has%20clearly%20been%20saving%2C%20pictures%20and%20little%20visual%20touches%20like%20tickets%20and%20notes.%0A%0AStart%20now%3A%20welcome%20me%20back%20in%20two%20lines%2C%20describe%20one%20odd%20change%20in%20the%20room%2C%20show%20a%20picture%2C%20then%20ask%20what%20the%20weather%20inside%20me%20is%20right%20now%2C%20with%20clickable%20options%20%28sunny%2C%20clearing%2C%20cloudy%2C%20foggy%2C%20rainy%2C%20thunder%2C%20chaotic%2C%20low%20energy%2C%20unclear%29%20and%20a%20place%20to%20type%20instead.";
  var API = "https://text.pollinations.ai/openai";
  var messages = [];          // { role: "host" | "visitor", text, show }
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
      b.addEventListener("click", function () {
        say("In the PhD Weather Room, I choose: " + c.emo + " " + c.title + ". Reveal it gently, with a small surprise.", c.emo + " " + c.title);
      });
      box.appendChild(b);
    });
  }
  function drawAll() {
    var log = $("room-log");
    log.innerHTML = "";
    var lastChoices = [];
    messages.forEach(function (m) {
      if (m.role === "host") { var d = el("div", "msg-host"); lastChoices = render(d, m.text, false); log.appendChild(d); }
      else { lastChoices = []; log.appendChild(el("div", "msg-me", m.show || m.text)); }
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

  /** Sends `textValue` to the storyteller; the visitor's bubble shows `shown` instead, if given. */
  function say(textValue, shown) {
    if (busy) return;
    messages.push({ role: "visitor", text: textValue, show: shown || null });
    drawAll();
    $("room-choices").innerHTML = "";
    var log = $("room-log");
    var box = el("div", "waiting", "The room is rearranging itself… ☁️");
    log.appendChild(box);
    box.scrollIntoView({ behavior: "smooth", block: "end" });
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
    if (/^\s*start (again|over)\W*$/i.test(t)) { restart(); return; }
    say(t);
  });

  // ---------- the opening: pick your inner weather (no waiting, nothing sent yet) ----------
  var WEATHERS = [["☀️", "Sunny"], ["🌤️", "Clearing"], ["☁️", "Cloudy"], ["🌫️", "Foggy"], ["🌧️", "Rainy"],
    ["⛈️", "Thunder"], ["🌪️", "Chaotic"], ["🌙", "Low energy"], ["🎭", "Unclear"]];
  var WELCOMES = [
    "The room has been quietly rearranged while you were away. The orange cat is missing. On the table there's a paper crane, a brass key, and a bowl containing one perfectly ordinary-looking potato. Nobody has explained the potato.",
    "The orange cat has saved your seat by the window. The little golden key is back on the table, and somewhere in the room, a tiny bell rings by itself.",
    "Someone has left the kettle on, very slightly. A moth in a waistcoat is reading the newspaper upside down and pretending not to notice you.",
    "The rain has stopped, but the window is covered in tiny glowing fingerprints. The orange cat insists it has no idea whose they are."
  ];
  var weather = "🌫️";
  function drawWeathers() {
    var g = $("weather-grid");
    g.innerHTML = "";
    WEATHERS.forEach(function (w) {
      var b = el("button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(w[0] === weather));
      b.appendChild(el("span", null, w[0]));
      b.appendChild(document.createTextNode(w[1]));
      b.addEventListener("click", function () { weather = w[0]; drawWeathers(); });
      g.appendChild(b);
    });
  }
  function showPicker() {
    $("room-weather").hidden = false;
    $("room-form").hidden = true;
    $("room-log").innerHTML = "";
    $("room-choices").innerHTML = "";
    text($("room-welcome"), WELCOMES[Math.floor(Math.random() * WELCOMES.length)]);
    var pic = $("room-welcome-pic");
    if (!pic.src) {
      pic.onerror = function () { pic.hidden = true; };
      pic.src = imageUrl("cozy attic room at twilight, rain-speckled window, small wooden table with a paper crane, a brass key and a potato in a ceramic bowl, warm lamplight", 768, 432);
    }
    $("weather-words").value = "";
    drawWeathers();
  }
  function text(node, t) { node.textContent = t; }
  function restart() {
    if (busy) return;
    messages = []; save();
    showPicker();
    window.scrollTo(0, 0);
  }
  $("weather-go").addEventListener("click", function () {
    if (busy) return;
    var words = $("weather-words").value.trim();
    $("room-weather").hidden = true;
    $("room-form").hidden = false;
    say("Start a fresh PhD Weather Room session. My current inner weather is " + weather + ". " +
      (words ? "What I'd like to share: " + words : "Please acknowledge gently and offer a small unexpected experience."),
      weather + (words ? " " + words : ""));
  });
  $("room-restart").addEventListener("click", restart);
  A.onShow.room = function () {
    if (busy) return;
    if (messages.length) {
      $("room-weather").hidden = true; $("room-form").hidden = false;
      drawAll(); var l = $("room-log").lastChild; if (l) l.scrollIntoView({ block: "start" });
    } else showPicker();
  };
})();
