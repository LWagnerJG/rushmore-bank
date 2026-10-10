/*
 * iOS software-keyboard emulator for Playwright WebKit (desktop WebKit has
 * no on-screen keyboard). Load with context.addInitScript after setting
 * window.__KB_CONFIG = { keyboardPx }. Test hooks live on window.__kbTest.
 *
 * Models the iOS WebKit behaviour that decides whether a field jumps or hides:
 *  - The layout viewport never shrinks (innerHeight / 100dvh stay put, and
 *    `interactive-widget` is ignored). Only visualViewport.height shrinks, in
 *    resize steps while the keyboard slides in and out.
 *  - The keyboard opens for a focus that follows a user gesture, or for a tap
 *    on a field that already has focus (autoFocus focuses without one). It
 *    closes when no text field is focused any more, including when the
 *    focused node is removed (WebKit fires no focusout for that).
 *  - Focus reveal (WKWebView _zoomToFocusRect): if the focused field is not
 *    entirely inside the visible area above the keyboard, the page pans
 *    (visualViewport.offsetTop) to reveal it. A field that is already fully
 *    visible is left alone. The same rule runs for the caret on every input.
 *  - window.scrollTo while the keyboard is up moves that pan.
 */
(function () {
  "use strict";
  var cfg = window.__KB_CONFIG || {};
  var KB = typeof cfg.keyboardPx === "number" ? cfg.keyboardPx : 336;
  var STEPS = cfg.steps || 6;
  var STEP_MS = cfg.stepMs || 45;
  var MARGIN = typeof cfg.revealMarginPx === "number" ? cfg.revealMarginPx : 8;
  var GESTURE_WINDOW_MS = 1000;
  var PAINT_ID = "__kb-paint";

  var events = new EventTarget();
  var st = { open: false, kbNow: 0, pan: 0, anim: null, closeTimer: null };
  var log = [];
  var lastGestureAt = -1e9;

  function now() {
    return Math.round(performance.now());
  }
  function r1(n) {
    return Math.round(n * 10) / 10;
  }
  function vvH() {
    return Math.max(0, window.innerHeight - st.kbNow);
  }
  function maxPanFor(h) {
    var de = document.documentElement;
    var docH = de ? de.getBoundingClientRect().height : window.innerHeight;
    return Math.max(0, Math.round(docH - h));
  }
  function describe(el) {
    if (!el || !el.tagName) return String(el);
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    var c = typeof el.className === "string" ? el.className.trim() : "";
    if (c) s += "." + c.split(/\s+/).slice(0, 3).join(".");
    return s;
  }

  // --- visualViewport ------------------------------------------------------
  var vv = {
    get width() {
      return window.innerWidth;
    },
    get height() {
      return vvH();
    },
    get offsetTop() {
      return st.pan;
    },
    get offsetLeft() {
      return 0;
    },
    get pageTop() {
      return window.scrollY + st.pan;
    },
    get pageLeft() {
      return window.scrollX;
    },
    get scale() {
      return 1;
    },
    onresize: null,
    onscroll: null,
    addEventListener: function (t, cb, o) {
      events.addEventListener(t, cb, o);
    },
    removeEventListener: function (t, cb, o) {
      events.removeEventListener(t, cb, o);
    },
    dispatchEvent: function (e) {
      return events.dispatchEvent(e);
    },
  };
  function fire(type) {
    var ev = new Event(type);
    events.dispatchEvent(ev);
    var h = vv["on" + type];
    if (typeof h === "function") h.call(vv, ev);
  }
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    get: function () {
      return vv;
    },
  });

  // --- keyboard --------------------------------------------------------------
  var NON_TEXT = {
    button: 1,
    submit: 1,
    reset: 1,
    checkbox: 1,
    radio: 1,
    file: 1,
    range: 1,
    color: 1,
    hidden: 1,
    image: 1,
  };
  function editable(el) {
    if (!el || !el.tagName) return false;
    if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    if (el.tagName === "INPUT")
      return !NON_TEXT[(el.type || "text").toLowerCase()];
    return !!el.isContentEditable;
  }

  function setPan(v, reason) {
    v = Math.max(0, Math.round(v));
    if (v === st.pan) return;
    log.push({ t: now(), type: "pan", from: st.pan, to: v, reason: reason });
    st.pan = v;
    fire("scroll");
  }
  function clampPan() {
    var mp = maxPanFor(vvH());
    if (st.pan > mp) setPan(mp, "clamp");
  }
  function reveal(reason, kbOverride) {
    var el = document.activeElement;
    if (!editable(el) || !st.open) return;
    var r = el.getBoundingClientRect();
    var h = window.innerHeight - (kbOverride == null ? st.kbNow : kbOverride);
    if (r.top >= st.pan - 0.5 && r.bottom <= st.pan + h + 0.5) return;
    var next = r.bottom > st.pan + h ? r.bottom + MARGIN - h : r.top - MARGIN;
    setPan(Math.max(0, Math.min(maxPanFor(h), Math.round(next))), reason);
  }

  function animateTo(targetKb, done) {
    if (st.anim) clearInterval(st.anim);
    var from = st.kbNow;
    var i = 0;
    st.anim = setInterval(function () {
      i++;
      var p = 1 - Math.pow(1 - i / STEPS, 3);
      st.kbNow = i >= STEPS ? targetKb : Math.round(from + (targetKb - from) * p);
      clampPan();
      fire("resize");
      if (i >= STEPS) {
        clearInterval(st.anim);
        st.anim = null;
        if (done) done();
      }
    }, STEP_MS);
  }
  function openKb(reason) {
    if (st.closeTimer) {
      clearTimeout(st.closeTimer);
      st.closeTimer = null;
    }
    if (st.open) {
      reveal("refocus");
      return;
    }
    st.open = true;
    log.push({ t: now(), type: "kb-open", reason: reason });
    // WebKit decides the reveal against the final keyboard frame.
    reveal("focus", KB);
    animateTo(KB, function () {
      reveal("kb-shown");
      log.push({ t: now(), type: "kb-shown" });
    });
  }
  function closeKb(reason) {
    if (!st.open) return;
    st.open = false;
    log.push({ t: now(), type: "kb-close", reason: reason });
    animateTo(0, function () {
      setPan(0, "kb-hidden");
      log.push({ t: now(), type: "kb-hidden" });
    });
  }

  ["touchstart", "pointerdown", "mousedown", "keydown"].forEach(function (t) {
    window.addEventListener(
      t,
      function () {
        lastGestureAt = performance.now();
      },
      true,
    );
  });
  // Bubble phase on window: runs after the app's own focusin handlers, like
  // WebKit reading the focused element after focus dispatch.
  window.addEventListener("focusin", function (e) {
    if (!editable(e.target)) return;
    if (performance.now() - lastGestureAt > GESTURE_WINDOW_MS) {
      log.push({ t: now(), type: "focus-no-keyboard", el: describe(e.target) });
      return;
    }
    openKb("focusin");
  });
  window.addEventListener(
    "touchend",
    function (e) {
      var el = document.activeElement;
      if (st.open || !editable(el)) return;
      if (e.target !== el && !(e.target instanceof Node && el.contains(e.target))) return;
      setTimeout(function () {
        if (document.activeElement === el) openKb("tap-focused");
      }, 0);
    },
    true,
  );
  window.addEventListener("focusout", function (e) {
    if (!st.open || editable(e.relatedTarget)) return;
    st.closeTimer = setTimeout(function () {
      st.closeTimer = null;
      if (!editable(document.activeElement)) closeKb("focusout");
    }, 0);
  });
  setInterval(function () {
    if (st.open && !st.closeTimer && !editable(document.activeElement))
      closeKb("focus-lost");
  }, 50);
  window.addEventListener("input", function () {
    reveal("caret");
  });

  // --- programmatic scroll log ---------------------------------------------
  var origScrollTo = window.scrollTo;
  window.scrollTo = function (x, y) {
    var yy = x && typeof x === "object" ? x.top : y;
    log.push({ t: now(), type: "window.scrollTo", y: yy });
    if (st.open && typeof yy === "number")
      setPan(Math.min(maxPanFor(vvH()), Math.max(0, yy)), "window.scrollTo");
    return origScrollTo.apply(window, arguments);
  };
  var origSiv = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function () {
    log.push({ t: now(), type: "scrollIntoView", el: describe(this) });
    return origSiv.apply(this, arguments);
  };
  ["scrollTop", "scrollLeft"].forEach(function (prop) {
    var d = Object.getOwnPropertyDescriptor(Element.prototype, prop);
    if (!d || !d.set) return;
    Object.defineProperty(Element.prototype, prop, {
      configurable: true,
      get: d.get,
      set: function (v) {
        if (d.get.call(this) !== v)
          log.push({ t: now(), type: "set." + prop, el: describe(this), v: v });
        d.set.call(this, v);
      },
    });
  });
  ["scrollTo", "scrollBy"].forEach(function (fn) {
    var orig = Element.prototype[fn];
    Element.prototype[fn] = function (a, b) {
      var vertical =
        a && typeof a === "object" ? typeof a.top === "number" : typeof b === "number";
      log.push({ t: now(), type: "el." + fn, el: describe(this), vertical: vertical });
      return orig.apply(this, arguments);
    };
  });

  // --- measurements ----------------------------------------------------------
  function rect(el) {
    if (!el) return null;
    var b = el.getBoundingClientRect();
    return {
      top: r1(b.top),
      bottom: r1(b.bottom),
      left: r1(b.left),
      right: r1(b.right),
      h: r1(b.height),
      w: r1(b.width),
    };
  }
  function appH() {
    return getComputedStyle(document.documentElement).getPropertyValue("--app-h").trim();
  }

  // Untransformed layout top relative to the document. Summed through the
  // offsetParent chain because a transform animation (the up-seat pop) makes
  // its element the offsetParent of its children for the duration.
  function layoutTop(el) {
    var y = 0;
    for (var n = el; n; n = n.offsetParent) {
      y += n.offsetTop;
      if (n !== el) y += n.clientTop;
    }
    return y;
  }

  // Layout boxes (transforms ignored) of every element that renders above
  // the field, keyed by node identity.
  var aboveBase = null;
  function markAbove(sel) {
    var input = document.querySelector(sel);
    aboveBase = new Map();
    if (!input) return 0;
    var top = input.getBoundingClientRect().top;
    var all = document.body.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!(el instanceof HTMLElement) || el.id === PAINT_ID) continue;
      if (el === input || el.contains(input)) continue;
      var b = el.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0 || b.bottom > top + 0.5) continue;
      aboveBase.set(el, { top: layoutTop(el), h: el.offsetHeight, d: describe(el) });
    }
    return aboveBase.size;
  }
  function checkAbove() {
    var changed = [];
    var removed = [];
    if (!aboveBase) return { tracked: 0, changed: changed, removed: removed };
    aboveBase.forEach(function (v, el) {
      if (!el.isConnected) {
        removed.push(v.d);
        return;
      }
      var h = el.offsetHeight;
      var t = layoutTop(el);
      if (Math.abs(h - v.h) > 1 || Math.abs(t - v.top) > 1)
        changed.push(v.d + ": top " + v.top + "→" + t + ", height " + v.h + "→" + h);
    });
    return { tracked: aboveBase.size, changed: changed, removed: removed };
  }

  // Event order of each tap (does the click reach the button, or <html>?).
  var tapLog = [];
  ["touchstart", "touchend", "pointerdown", "mousedown", "focusout", "mouseup", "click"].forEach(
    function (type) {
      window.addEventListener(
        type,
        function (e) {
          tapLog.push({ t: now(), type: type, target: describe(e.target), appH: appH() });
        },
        true,
      );
    },
  );

  var ENTRY = /^(phase-enter|motion-enter|animate-[\w-]+)$/;
  var classLog = [];
  var nodeLog = [];
  var mo = null;
  var marks = {};
  var trace = null;

  function watch(scopeSel) {
    if (mo) mo.disconnect();
    classLog.length = 0;
    nodeLog.length = 0;
    var scope = scopeSel ? document.querySelector(scopeSel) : null;
    mo = new MutationObserver(function (records) {
      records.forEach(function (rec) {
        var target = rec.target;
        var inScope = !!(scope && target instanceof Node && scope.contains(target));
        if (rec.type === "attributes") {
          var before = (rec.oldValue || "").split(/\s+/).filter(Boolean);
          var after =
            typeof target.className === "string"
              ? target.className.split(/\s+/).filter(Boolean)
              : [];
          var added = after.filter(function (c) {
            return before.indexOf(c) < 0;
          });
          var removed = before.filter(function (c) {
            return after.indexOf(c) < 0;
          });
          if (added.length || removed.length)
            classLog.push({
              t: now(),
              el: describe(target),
              inScope: inScope,
              added: added,
              removed: removed,
            });
        } else if (rec.type === "childList") {
          for (var i = 0; i < rec.addedNodes.length; i++) {
            var n = rec.addedNodes[i];
            if (n.nodeType !== 1 || n.id === PAINT_ID) continue;
            var entry = [];
            [n].concat(Array.prototype.slice.call(n.querySelectorAll("*"))).forEach(function (el) {
              var cls = typeof el.className === "string" ? el.className.split(/\s+/) : [];
              if (cls.some(function (c) { return ENTRY.test(c); })) entry.push(describe(el));
            });
            nodeLog.push({ t: now(), el: describe(n), inScope: inScope, entry: entry });
          }
        }
      });
    });
    mo.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
      childList: true,
    });
  }

  // Running animations on the field or any ancestor (a re-applied enter
  // animation on a wrapper is the "blink").
  function animationsOn(sel) {
    var el = document.querySelector(sel);
    if (!el || !document.getAnimations) return [];
    return document
      .getAnimations()
      .filter(function (a) {
        var t = a.effect && a.effect.target;
        return a.playState === "running" && t && (t === el || t.contains(el));
      })
      .map(function (a) {
        return describe(a.effect.target) + ":" + (a.animationName || a.transitionProperty || "animation");
      });
  }

  window.__kbTest = {
    log: log,
    tapLog: tapLog,
    classLog: classLog,
    nodeLog: nodeLog,
    describe: describe,
    state: function () {
      return {
        open: st.open,
        kb: st.kbNow,
        pan: st.pan,
        vvH: vvH(),
        innerH: window.innerHeight,
        settled: !st.anim,
      };
    },
    sample: function (inputSel, submitSel) {
      var input = document.querySelector(inputSel);
      var submit = submitSel ? document.querySelector(submitSel) : null;
      var scroller = input && input.closest(".room-phase-scroll, .app-shell-scroll");
      return {
        t: now(),
        kbOpen: st.open,
        vvH: vvH(),
        pan: st.pan,
        scrollY: window.scrollY,
        scrollerTop: scroller ? scroller.scrollTop : 0,
        appH: appH(),
        active: describe(document.activeElement),
        focused: !!input && document.activeElement === input,
        input: rect(input),
        submit: rect(submit),
        submitText: submit ? (submit.textContent || "").trim() : null,
        value: input ? input.value : null,
        fontSize: input ? parseFloat(getComputedStyle(input).fontSize) : null,
      };
    },
    markAbove: markAbove,
    checkAbove: checkAbove,
    watch: watch,
    animationsOn: animationsOn,
    mark: function (name, sel) {
      marks[name] = document.querySelector(sel);
      return !!marks[name];
    },
    same: function (name, sel) {
      return marks[name] != null && marks[name] === document.querySelector(sel);
    },
    startTrace: function (inputSel, submitSel) {
      trace = [];
      function tick() {
        if (!trace) return;
        var input = document.querySelector(inputSel);
        var submit = submitSel ? document.querySelector(submitSel) : null;
        var ir = input ? input.getBoundingClientRect() : null;
        var sr = submit ? submit.getBoundingClientRect() : null;
        trace.push({
          t: now(),
          inputTop: ir ? r1(ir.top) : null,
          inputBottom: ir ? r1(ir.bottom) : null,
          submitTop: sr ? r1(sr.top) : null,
          submitBottom: sr ? r1(sr.bottom) : null,
          pan: st.pan,
          vvH: vvH(),
          scrollY: window.scrollY,
          appH: appH(),
        });
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      return true;
    },
    stopTrace: function () {
      var t = trace;
      trace = null;
      return t || [];
    },
    // Screenshot aid: paints the keyboard and shifts the page by the pan so
    // the image shows what an iPhone would.
    paintKeyboard: function (on) {
      var el = document.getElementById(PAINT_ID);
      var root = document.documentElement;
      if (!on) {
        if (el) el.remove();
        root.style.removeProperty("translate");
        return;
      }
      if (!el) {
        el = document.createElement("div");
        el.id = PAINT_ID;
        document.body.appendChild(el);
      }
      if (st.pan) root.style.translate = "0 " + -st.pan + "px";
      el.style.cssText =
        "position:fixed;left:0;right:0;z-index:2147483647;pointer-events:none;" +
        "background:rgba(40,44,52,.86);color:#fff;font:600 13px system-ui;display:flex;" +
        "align-items:flex-start;justify-content:center;padding-top:10px;box-sizing:border-box;" +
        "top:" + (st.pan + vvH()) + "px;height:" + st.kbNow + "px;";
      el.textContent =
        "emulated keyboard " + st.kbNow + "px" + (st.pan ? " · page panned " + st.pan + "px" : "");
    },
  };
})();
