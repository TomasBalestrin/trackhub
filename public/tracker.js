/**
 * Bethel TrackHub - Script de Rastreamento
 *
 * Cole este script em qualquer site/landing page externa:
 * <script src="https://SEU_DOMINIO/tracker.js" data-pixel="SEU_PIXEL_ID" data-api="https://SEU_DOMINIO" data-source="nome-do-site"></script>
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var PIXEL_ID = script && script.getAttribute("data-pixel");
  var API_URL = script && script.getAttribute("data-api");
  var SOURCE = script && script.getAttribute("data-source");
  var STORAGE_KEY = "bethel_track";

  // ============================================
  // UTM Capture
  // ============================================
  function getURLParams() {
    var params = {};
    var keys = [
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "fbclid", "ad_name", "adset_name", "campaign_name", "creative_type",
      "ad_id", "adset_id", "campaign_id"
    ];
    var search = new URLSearchParams(window.location.search);
    keys.forEach(function (key) {
      var val = search.get(key);
      if (val) params[key] = val;
    });
    return params;
  }

  function storeParams(params) {
    if (Object.keys(params).length === 0) return;
    try {
      var json = JSON.stringify(params);
      sessionStorage.setItem(STORAGE_KEY, json);
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) { /* ignore */ }
  }

  function getStoredParams() {
    try {
      var s = sessionStorage.getItem(STORAGE_KEY);
      if (s) return JSON.parse(s);
      var l = localStorage.getItem(STORAGE_KEY);
      if (l) return JSON.parse(l);
    } catch (e) { /* ignore */ }
    return {};
  }

  // ============================================
  // Facebook Cookies
  // ============================================
  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? match[2] : null;
  }

  function getFBC(fbclid) {
    var fbc = getCookie("_fbc");
    if (fbc) return fbc;
    if (fbclid) return "fb.1." + Date.now() + "." + fbclid;
    return null;
  }

  function getFBP() {
    return getCookie("_fbp") || null;
  }

  // ============================================
  // Event ID (deduplication)
  // ============================================
  function generateEventId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // ============================================
  // Send event to TrackHub API
  // ============================================
  function sendToAPI(eventName, eventId, extraData) {
    if (!API_URL) return;
    var params = getStoredParams();
    var payload = {
      event_name: eventName,
      event_id: eventId,
      fbclid: params.fbclid || null,
      fbc: getFBC(params.fbclid),
      fbp: getFBP(),
      url: window.location.href,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      source: SOURCE || null,
      utm_data: params,
      extra: extraData || {}
    };

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API_URL + "/api/tracking", JSON.stringify(payload));
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", API_URL + "/api/tracking", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify(payload));
      }
    } catch (e) { /* ignore */ }
  }

  // ============================================
  // Meta Pixel Events
  // ============================================
  function firePixelEvent(eventName, eventId, data) {
    if (typeof fbq === "undefined") return;
    fbq("track", eventName, data || {}, { eventID: eventId });
  }

  function trackEvent(eventName, data) {
    var eventId = generateEventId();
    firePixelEvent(eventName, eventId, data);
    sendToAPI(eventName, eventId, data);
    return eventId;
  }

  // ============================================
  // Auto-init on page load
  // ============================================
  var params = getURLParams();
  storeParams(params);

  // Init Pixel if not already loaded
  if (PIXEL_ID && typeof fbq === "undefined") {
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

    fbq("init", PIXEL_ID);
  }

  // Auto PageView
  trackEvent("PageView");

  // Auto ViewContent on scroll 50% or 10s
  var firedViewContent = false;
  function fireViewContent() {
    if (firedViewContent) return;
    firedViewContent = true;
    trackEvent("ViewContent", { content_name: document.title });
  }

  setTimeout(fireViewContent, 10000);
  window.addEventListener("scroll", function () {
    var pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
    if (pct >= 0.5) fireViewContent();
  }, { passive: true });

  // ============================================
  // Auto Button Click Tracking
  // ============================================
  var trackedClicks = {};
  document.addEventListener("click", function (e) {
    var el = e.target;
    // Walk up to find the closest button or link
    while (el && el !== document.body) {
      var tag = (el.tagName || "").toLowerCase();
      var role = (el.getAttribute("role") || "").toLowerCase();
      if (tag === "button" || tag === "a" || role === "button" || el.classList.contains("framer-button")) {
        var text = (el.textContent || "").trim().substring(0, 100);
        if (!text) { el = el.parentElement; continue; }
        // Deduplicate: only track each unique button text once per page
        if (trackedClicks[text]) break;
        trackedClicks[text] = true;
        trackEvent("ButtonClick", {
          button_text: text,
          button_url: el.href || null,
          page_url: window.location.href
        });
        break;
      }
      el = el.parentElement;
    }
  }, true);

  // ============================================
  // Auto Form Interception
  // ============================================
  function extractEmailFromForm(form) {
    // Try input[type="email"] first
    var emailInput = form.querySelector('input[type="email"]');
    if (emailInput && emailInput.value) return emailInput.value.trim();
    // Try input[name containing "email"]
    var inputs = form.querySelectorAll("input");
    for (var i = 0; i < inputs.length; i++) {
      var name = (inputs[i].name || "").toLowerCase();
      var placeholder = (inputs[i].placeholder || "").toLowerCase();
      if ((name.indexOf("email") !== -1 || placeholder.indexOf("email") !== -1) && inputs[i].value) {
        return inputs[i].value.trim();
      }
    }
    return null;
  }

  function extractFormData(form) {
    var data = {};
    var inputs = form.querySelectorAll("input, select, textarea");
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var name = (el.name || el.id || "").toLowerCase();
      if (name && el.value) data[name] = el.value;
    }
    return data;
  }

  function sendEnrichment(email, formData) {
    if (!API_URL || !email) return;
    var params = getStoredParams();
    // Fallback: re-extract UTMs from current URL if stored params are missing
    // (fixes iOS Instagram WebView where sessionStorage may fail)
    var freshParams = getURLParams();
    var payload = {
      email: email,
      utm_source: params.utm_source || freshParams.utm_source || null,
      utm_medium: params.utm_medium || freshParams.utm_medium || null,
      utm_campaign: params.utm_campaign || freshParams.utm_campaign || null,
      utm_content: params.utm_content || freshParams.utm_content || null,
      utm_term: params.utm_term || freshParams.utm_term || null,
      fbclid: params.fbclid || freshParams.fbclid || null,
      fbc: getFBC(params.fbclid || freshParams.fbclid),
      fbp: getFBP(),
      ad_name: params.ad_name || freshParams.ad_name || null,
      adset_name: params.adset_name || freshParams.adset_name || null,
      campaign_name: params.campaign_name || freshParams.campaign_name || null,
      creative_type: params.creative_type || freshParams.creative_type || null,
      ad_id: params.ad_id || freshParams.ad_id || null,
      adset_id: params.adset_id || freshParams.adset_id || null,
      campaign_id: params.campaign_id || freshParams.campaign_id || null,
      landing_page_url: window.location.href,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      source: SOURCE || null,
      form_data: formData || {}
    };

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API_URL + "/api/tracking/enrich", JSON.stringify(payload));
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", API_URL + "/api/tracking/enrich", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify(payload));
      }
    } catch (e) { /* ignore */ }
  }

  // Listen for all form submissions on the page
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;
    var email = extractEmailFromForm(form);
    var formData = extractFormData(form);
    if (email) {
      sendEnrichment(email, formData);
      // Also fire Lead pixel event
      trackEvent("Lead", { email: email });
    }
  }, true);

  // Also observe for dynamically added forms (Framer renders forms dynamically)
  if (typeof MutationObserver !== "undefined") {
    var observer = new MutationObserver(function () {
      // Attach to forms that use fetch/XHR instead of native submit
      var forms = document.querySelectorAll("form:not([data-bethel-tracked])");
      for (var i = 0; i < forms.length; i++) {
        forms[i].setAttribute("data-bethel-tracked", "1");
        // Some Framer forms use button click instead of form submit
        var buttons = forms[i].querySelectorAll('button[type="submit"], button:not([type])');
        for (var j = 0; j < buttons.length; j++) {
          (function (form, btn) {
            btn.addEventListener("click", function () {
              setTimeout(function () {
                var email = extractEmailFromForm(form);
                var formData = extractFormData(form);
                if (email) {
                  sendEnrichment(email, formData);
                  trackEvent("Lead", { email: email });
                }
              }, 100); // Small delay to let form validation run
            });
          })(forms[i], buttons[j]);
        }
      }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  // ============================================
  // Public API - window.BethelTrack
  // ============================================
  window.BethelTrack = {
    track: trackEvent,
    getParams: getStoredParams,
    getEventId: generateEventId,

    // Chamar quando o lead submeter o formulario externo
    trackLead: function (userData) {
      return trackEvent("Lead", userData || {});
    },

    // Chamar na pagina de obrigado/confirmacao
    trackComplete: function () {
      return trackEvent("CompleteRegistration");
    },

    // Retorna todos os UTM params para incluir em formularios hidden fields
    getHiddenFields: function () {
      var p = getStoredParams();
      p.fbc = getFBC(p.fbclid);
      p.fbp = getFBP();
      p.source = SOURCE || "";
      p.tracker_url = window.location.href;
      p.tracker_referrer = document.referrer || "";
      return p;
    },

    // Preenche campos hidden de um formulario automaticamente
    fillForm: function (formSelector) {
      var form = document.querySelector(formSelector);
      if (!form) return;
      var fields = this.getHiddenFields();
      Object.keys(fields).forEach(function (key) {
        var input = form.querySelector('[name="' + key + '"]');
        if (input && fields[key]) {
          input.value = fields[key];
        }
      });
    }
  };
})();
