// TheFreedomZone anti-skid deterrents + Resource Saver + gated download.
// This only makes casual copying harder; it cannot stop View-Source or DevTools.
(function () {
    "use strict";

    // Replace with whatever copy you actually hand out (zip, repo archive, etc.)

    // ---- keyboard / context-menu deterrents ----
    document.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        return false;
    });

    document.addEventListener("keydown", function (e) {
        const k = (e.key || "").toLowerCase();
        if (e.key === "F12") { e.preventDefault(); return; }
        if (e.ctrlKey && e.shiftKey && (k === "i" || k === "j" || k === "c" || k === "k")) {
            e.preventDefault(); return;
        }
        if (e.ctrlKey && (k === "u" || k === "s")) { e.preventDefault(); return; }
    });

    // disable text selection + image drag as an extra deterrent
    const antiStyle = document.createElement("style");
    antiStyle.textContent =
        "body{user-select:none;-webkit-user-select:none}" +
        "img{-webkit-user-drag:none;user-drag:none}";
    document.head.appendChild(antiStyle);

    // ---- lightweight devtools size check (only after 4 consecutive hits) ----
    let devtoolsHits = 0;
    const devtoolsTimer = setInterval(function () {
        const widthThresh = window.outerWidth - window.innerWidth > 200;
        const heightThresh = window.outerHeight - window.innerHeight > 200;
        if (widthThresh || heightThresh) {
            devtoolsHits++;
            if (devtoolsHits >= 4) {
                clearInterval(devtoolsTimer);
                const warning = document.getElementById("fz-devtools-warning");
                if (warning) warning.style.display = "flex";
            }
        } else {
            devtoolsHits = Math.max(0, devtoolsHits - 1);
        }
    }, 2000);

    // ---- Resource Saver (lite mode): skip heavy remote covers & popularity ----
    const SAVER_KEY = "fz_saver";
    window.resourceSaver = {
        isOn: function () {
            try { return localStorage.getItem(SAVER_KEY) === "1"; } catch (e) { return false; }
        },
        toggle: function () {
            const on = !this.isOn();
            try { localStorage.setItem(SAVER_KEY, on ? "1" : "0"); } catch (e) { }
            return on;
        }
    };

    // inject the devtools warning overlay + watermark (idempotent)
    function ensureUi() {
        if (document.getElementById("fz-devtools-warning")) return;
        const overlay = document.createElement("div");
        overlay.id = "fz-devtools-warning";
        overlay.style.cssText =
            "position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;" +
            "background:rgba(0,0,0,0.92);color:#fff;font-family:monospace;text-align:center;padding:24px";
        overlay.innerHTML =
            '<div><h2 style="margin:0 0 12px">Please don\u2019t inspect this site.</h2>' +
            '<p style="margin:0 0 16px;max-width:480px">TheFreedomZone is the work of its owner. ' +
            "If you'd like your own copy, grab it from the Settings menu.</p>" +
            '<button id="fz-devtools-ok" style="padding:8px 18px;cursor:pointer">Close</button></div>';
        document.body.appendChild(overlay);
        const btn = document.getElementById("fz-devtools-ok");
        if (btn) btn.onclick = function () { overlay.style.display = "none"; };
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ensureUi);
    } else {
        ensureUi();
    }
})();
