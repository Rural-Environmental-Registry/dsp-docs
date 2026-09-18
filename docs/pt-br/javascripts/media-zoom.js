/**
 * Zoom/pan fullscreen viewer for Mermaid diagrams and article images (Zensical + instant navigation).
 */
(function () {
  const MIN_SCALE = 0.25;
  const MAX_SCALE_IMAGE = 8;
  const MAX_SCALE_MERMAID = 16;
  const WHEEL_STEP = 0.12;
  const MIN_COMFORT_SCALE = 1.85;
  const INITIAL_ZOOM_PADDING = 0.9;
  const FULLSCREEN_HINT_MS = 3000;
  const CHROMIUM_MERMAID_CSS_ZOOM_CAP = 9.5;

  let overlay = null;
  let stage = null;
  let panEl = null;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panOriginX = 0;
  let panOriginY = 0;
  let contentObserver = null;
  let hintObserver = null;
  const observedHints = new WeakSet();
  let activeHost = null;
  let hostAnchor = null;
  let mermaidLayoutWidth = 0;
  let mermaidLayoutHeight = 0;

  const ICON = {
    zoomIn:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>',
    zoomOut:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>',
    reset:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    close:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  };

  function actionButton(action, label, icon) {
    return (
      '<button type="button" class="media-zoom-btn" data-zoom-action="' +
      action +
      '" aria-label="' +
      label +
      '">' +
      icon +
      "</button>"
    );
  }

  function runToolbarAction(action) {
    if (action === "close") {
      closeOverlay();
      return;
    }
    if (action === "zoom-in") {
      scale = clampScale(scale + 0.25);
      applyTransform();
      return;
    }
    if (action === "zoom-out") {
      scale = clampScale(scale - 0.25);
      applyTransform();
      return;
    }
    if (action === "reset") {
      resetView();
    }
  }

  function bindToolbarActions(toolbar) {
    toolbar.querySelectorAll("[data-zoom-action]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        runToolbarAction(button.getAttribute("data-zoom-action"));
      });
    });
  }

  function isMermaidHost(host) {
    return host && host.getAttribute("data-zoom-host") === "mermaid";
  }

  function isChromiumBrowser() {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /Chrome|Chromium|Edg\//.test(ua) && !/Firefox/i.test(ua);
  }

  function clearMermaidZoomStyles(host) {
    if (!host) return;
    host.style.zoom = "";
    const svg = host.querySelector("svg");
    if (!svg) return;
    svg.style.width = "";
    svg.style.height = "";
    svg.style.maxWidth = "";
    svg.style.maxHeight = "";
  }

  function readMermaidBaseSize(host) {
    const svg = host && host.querySelector("svg");
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { w: rect.width, h: rect.height };
    }

    const viewBox = svg.viewBox && svg.viewBox.baseVal;
    let w = parseFloat(svg.getAttribute("width"));
    let h = parseFloat(svg.getAttribute("height"));
    if (!(w > 0 && h > 0) && viewBox && viewBox.width > 0 && viewBox.height > 0) {
      w = viewBox.width;
      h = viewBox.height;
    }
    if (!(w > 0 && h > 0)) {
      try {
        const box = svg.getBBox();
        if (box.width > 0 && box.height > 0) {
          w = box.width;
          h = box.height;
        }
      } catch (_err) {
        /* SVG not rendered yet */
      }
    }
    if (w > 0 && h > 0) return { w: w, h: h };
    if (w > 0) return { w: w, h: w };
    return null;
  }

  function storeMermaidBaseSize(host) {
    const base = readMermaidBaseSize(host);
    if (!base) return false;
    mermaidLayoutWidth = base.w;
    mermaidLayoutHeight = base.h;
    return true;
  }

  function ensureMermaidBaseSize() {
    if (!isMermaidHost(activeHost)) return false;
    if (mermaidLayoutWidth > 0 && mermaidLayoutHeight > 0) return true;
    clearMermaidZoomStyles(activeHost);
    return storeMermaidBaseSize(activeHost);
  }

  function mermaidUsesDedicatedZoom() {
    return isMermaidHost(activeHost) && mermaidLayoutWidth > 0 && mermaidLayoutHeight > 0;
  }

  function applyMermaidVisualScale() {
    const svg = activeHost.querySelector("svg");
    if (!svg) return;

    activeHost.style.zoom = "";
    svg.style.maxWidth = "none";
    svg.style.maxHeight = "none";

    if (isChromiumBrowser()) {
      const zoomPart = Math.min(scale, CHROMIUM_MERMAID_CSS_ZOOM_CAP);
      const sizePart = scale / zoomPart;
      svg.style.width = mermaidLayoutWidth * sizePart + "px";
      svg.style.height = mermaidLayoutHeight * sizePart + "px";
      if (zoomPart !== 1) {
        activeHost.style.zoom = String(zoomPart);
      }
      return;
    }

    svg.style.width = mermaidLayoutWidth * scale + "px";
    svg.style.height = mermaidLayoutHeight * scale + "px";
  }

  function applyTransform() {
    if (!panEl) return;
    if (isMermaidHost(activeHost)) {
      ensureMermaidBaseSize();
    }
    const mermaidZoom = mermaidUsesDedicatedZoom();
    panEl.style.transform =
      "translate(" + translateX + "px, " + translateY + "px)" +
      (mermaidZoom ? "" : " scale(" + scale + ")");
    if (mermaidZoom && activeHost) {
      applyMermaidVisualScale();
    }
  }

  function resetView() {
    translateX = 0;
    translateY = 0;
    scale = 1;
    if (isMermaidHost(activeHost)) {
      clearMermaidZoomStyles(activeHost);
    }
    applyTransform();

    if (!activeHost || !stage) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const stageWidth = stage.clientWidth;
        const stageHeight = stage.clientHeight;
        if (!stageWidth || !stageHeight) {
          scale = MIN_COMFORT_SCALE;
          applyTransform();
          return;
        }

        if (isMermaidHost(activeHost)) {
          ensureMermaidBaseSize();
        }

        const hostRect = activeHost.getBoundingClientRect();
        const hostWidth = mermaidLayoutWidth > 0 ? mermaidLayoutWidth : hostRect.width;
        const hostHeight = mermaidLayoutHeight > 0 ? mermaidLayoutHeight : hostRect.height;
        if (!hostWidth || !hostHeight) {
          scale = MIN_COMFORT_SCALE;
          applyTransform();
          return;
        }

        const fitX = (stageWidth * INITIAL_ZOOM_PADDING) / hostWidth;
        const fitY = (stageHeight * INITIAL_ZOOM_PADDING) / hostHeight;
        let fit = Math.min(fitX, fitY);

        if (fit >= 1) {
          scale = clampScale(Math.min(Math.max(MIN_COMFORT_SCALE, fit), maxScaleForHost(activeHost)));
        } else {
          scale = clampScale(fit);
        }
        applyTransform();
      });
    });
  }

  function maxScaleForHost(host) {
    if (host && host.getAttribute("data-zoom-host") === "mermaid") {
      return MAX_SCALE_MERMAID;
    }
    return MAX_SCALE_IMAGE;
  }

  function clampScale(value) {
    return Math.min(maxScaleForHost(activeHost), Math.max(MIN_SCALE, value));
  }

  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "media-zoom-overlay";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Enlarged view");

    const toolbar = document.createElement("div");
    toolbar.className = "media-zoom-toolbar";
    toolbar.innerHTML =
      '<div class="media-zoom-actions">' +
      actionButton("zoom-in", "Zoom in", ICON.zoomIn) +
      actionButton("zoom-out", "Zoom out", ICON.zoomOut) +
      actionButton("reset", "Reset zoom", ICON.reset) +
      actionButton("close", "Close", ICON.close) +
      "</div>";

    stage = document.createElement("div");
    stage.className = "media-zoom-stage";

    panEl = document.createElement("div");
    panEl.className = "media-zoom-pan";
    stage.appendChild(panEl);

    overlay.appendChild(toolbar);
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    bindToolbarActions(toolbar);

    stage.addEventListener(
      "wheel",
      function (event) {
        event.preventDefault();
        const delta = event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP;
        scale = clampScale(scale + delta);
        applyTransform();
      },
      { passive: false }
    );

    overlay.addEventListener(
      "dragstart",
      function (event) {
        event.preventDefault();
      },
      true
    );

    stage.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      event.preventDefault();
      isPanning = true;
      stage.classList.add("is-panning");
      panStartX = event.clientX;
      panStartY = event.clientY;
      panOriginX = translateX;
      panOriginY = translateY;
      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener("pointermove", function (event) {
      if (!isPanning) return;
      translateX = panOriginX + (event.clientX - panStartX);
      translateY = panOriginY + (event.clientY - panStartY);
      applyTransform();
    });

    stage.addEventListener("pointerup", function (event) {
      isPanning = false;
      stage.classList.remove("is-panning");
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch (_err) {
        /* ignore */
      }
    });

    stage.addEventListener("pointercancel", function () {
      isPanning = false;
      stage.classList.remove("is-panning");
    });

    document.addEventListener("keydown", function (event) {
      if (!overlay || overlay.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
      }
      if (event.key === "+" || event.key === "=") {
        scale = clampScale(scale + 0.25);
        applyTransform();
      }
      if (event.key === "-") {
        scale = clampScale(scale - 0.25);
        applyTransform();
      }
    });
  }

  function isZoomableHost(element) {
    if (!element || !element.matches) return false;
    return (
      element.matches("[data-zoom-host].media-zoomable") ||
      element.matches("div.mermaid.media-zoomable")
    );
  }

  function registerZoomHost(el, type, label) {
    el.setAttribute("data-zoom-host", type);
    el.classList.add("media-zoomable");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", label);
    el.dataset.zoomInit = "1";
    observeFullscreenHint(el);
  }

  function openOverlay(sourceHost) {
    if (!isZoomableHost(sourceHost)) return;

    ensureOverlay();
    if (activeHost && activeHost !== sourceHost) {
      closeOverlay();
    }

    mermaidLayoutWidth = 0;
    mermaidLayoutHeight = 0;
    if (isMermaidHost(sourceHost)) {
      storeMermaidBaseSize(sourceHost);
    }

    hostAnchor = document.createComment("media-zoom-anchor");
    sourceHost.before(hostAnchor);
    panEl.appendChild(sourceHost);
    activeHost = sourceHost;

    if (overlay) {
      overlay.classList.toggle("media-zoom-overlay--mermaid", isMermaidHost(activeHost));
    }

    const overlayImg = sourceHost.querySelector("img");
    if (overlayImg) {
      overlayImg.setAttribute("draggable", "false");
    }

    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    resetView();
    overlay.querySelector('[data-zoom-action="close"]').focus();
  }

  function closeOverlay() {
    if (!overlay) return;

    if (activeHost && hostAnchor && hostAnchor.parentNode) {
      clearMermaidZoomStyles(activeHost);
      hostAnchor.replaceWith(activeHost);
    }
    activeHost = null;
    hostAnchor = null;
    mermaidLayoutWidth = 0;
    mermaidLayoutHeight = 0;

    if (overlay) {
      overlay.classList.remove("media-zoom-overlay--mermaid");
    }
    overlay.hidden = true;
    document.body.style.overflow = "";
    translateX = 0;
    translateY = 0;
    scale = 1;
    applyTransform();
  }

  function cancelFullscreenHint(host) {
    if (host._mediaZoomHintTimer) {
      window.clearTimeout(host._mediaZoomHintTimer);
      host._mediaZoomHintTimer = null;
    }
    host.classList.remove("media-zoom-hint-show");
  }

  function showFullscreenHintBriefly(host) {
    cancelFullscreenHint(host);
    host.classList.add("media-zoom-hint-show");
    host._mediaZoomHintTimer = window.setTimeout(function () {
      host.classList.remove("media-zoom-hint-show");
      host._mediaZoomHintTimer = null;
    }, FULLSCREEN_HINT_MS);
  }

  function ensureHintObserver() {
    if (hintObserver) return;

    hintObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          const host = entry.target;
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            showFullscreenHintBriefly(host);
          } else {
            cancelFullscreenHint(host);
          }
        });
      },
      { threshold: [0, 0.15, 0.35] }
    );
  }

  function observeFullscreenHint(host) {
    ensureHintObserver();
    if (observedHints.has(host)) return;
    observedHints.add(host);
    hintObserver.observe(host);
  }

  function shouldZoomImage(img) {
    if (img.closest(".zoom-media-host")) return false;
    if (img.closest(".media-zoom-overlay")) return false;
    if (img.closest(".mermaid")) return false;
    if (img.closest("a")) return false;
    if (img.classList.contains("twemoji")) return false;
    if (!img.parentNode) return false;
    return true;
  }

  function markZoomableDiagrams(scope) {
    scope.querySelectorAll("div.mermaid").forEach(function (el) {
      if (el.dataset.zoomInit === "1") {
        if (!el.getAttribute("data-zoom-host")) {
          el.setAttribute("data-zoom-host", "mermaid");
        }
        observeFullscreenHint(el);
        return;
      }
      registerZoomHost(el, "mermaid", "Open diagram in fullscreen");
    });
  }

  function markZoomableImages(scope) {
    scope.querySelectorAll("img").forEach(function (img) {
      if (img.dataset.zoomInit === "skip" || img.dataset.zoomInit === "1") return;
      if (!shouldZoomImage(img)) {
        img.dataset.zoomInit = "skip";
        return;
      }

      const host = document.createElement("span");
      host.className = "zoom-media-host";
      img.parentNode.insertBefore(host, img);
      host.appendChild(img);
      img.dataset.zoomInit = "1";
      registerZoomHost(host, "image", "Open image in fullscreen");
    });
  }

  function markZoomableMedia(scope) {
    markZoomableDiagrams(scope);
    markZoomableImages(scope);
  }

  function findZoomTarget(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      if (node instanceof Element && isZoomableHost(node)) {
        return node;
      }
    }
    if (event.target && event.target.closest) {
      return event.target.closest("[data-zoom-host].media-zoomable, div.mermaid.media-zoomable");
    }
    return null;
  }

  function onMediaActivate(event) {
    if (event.target.closest(".media-zoom-overlay")) return;
    const target = findZoomTarget(event);
    if (!target) return;
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    if (event.type === "keydown") event.preventDefault();
    event.preventDefault();
    event.stopPropagation();
    openOverlay(target);
  }

  function bindDocumentHandlers() {
    document.addEventListener("click", onMediaActivate, true);
    document.addEventListener("keydown", onMediaActivate);
  }

  function watchZoomableContent() {
    const article = document.querySelector(".md-content__inner");
    if (!article) return;

    markZoomableMedia(article);

    if (contentObserver) {
      contentObserver.disconnect();
    }

    contentObserver = new MutationObserver(function () {
      markZoomableMedia(article);
    });
    contentObserver.observe(article, { childList: true, subtree: true });

    if (watchZoomableContent._retryTimer) {
      window.clearInterval(watchZoomableContent._retryTimer);
    }
    let attempts = 0;
    watchZoomableContent._retryTimer = window.setInterval(function () {
      markZoomableMedia(article);
      attempts += 1;
      if (attempts >= 40) {
        window.clearInterval(watchZoomableContent._retryTimer);
        watchZoomableContent._retryTimer = null;
      }
    }, 250);
  }

  function init() {
    if (activeHost) {
      closeOverlay();
    }
    watchZoomableContent();
  }

  function subscribe() {
    if (typeof document$ !== "undefined" && document$.subscribe) {
      document$.subscribe(function () {
        init();
      });
    } else {
      document.addEventListener("DOMContentLoaded", init);
      init();
    }
  }

  bindDocumentHandlers();
  subscribe();
})();
