// TheFreedomZone gate: fetches the encrypted zone catalog (zones.bin) and
// decrypts it in-memory with the owner's passcode. Nothing is ever written
// to disk; the deployed site contains only this shell + ciphertext.
(function () {
    "use strict";

    var BLOB_URL = "javascript/zones.bin";
    var SALT_B64 = "wiaGsDfY2F91q8nrNk68/w==";
    var ITERS = 100000;
    var KEY_BITS = 256;
    var DATA_KEY = "fz_data";
    var UNLOCK_KEY = "fz_unlocked";

    function base64ToBytes(b64) {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    function deriveKey(passcode) {
        var enc = new TextEncoder();
        var salt = base64ToBytes(SALT_B64);
        return crypto.subtle.importKey("raw", enc.encode(passcode), "PBKDF2", false, ["deriveKey"])
            .then(function (keyMaterial) {
                return crypto.subtle.deriveKey(
                    { name: "PBKDF2", salt: salt, iterations: ITERS, hash: "SHA-256" },
                    keyMaterial,
                    { name: "AES-GCM", length: KEY_BITS },
                    false,
                    ["decrypt"]
                );
            });
    }

    function decryptZones(passcode) {
        var iv;
        var data;
        return fetch(BLOB_URL, { cache: "no-cache" })
            .then(function (res) {
                if (!res.ok) throw new Error("blob " + res.status);
                return res.arrayBuffer();
            })
            .then(function (buf) {
                iv = buf.slice(0, 12);
                data = buf.slice(12);
                return deriveKey(passcode);
            })
            .then(function (key) {
                return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
            })
            .then(function (plain) {
                var parsed = JSON.parse(new TextDecoder("utf-8").decode(plain));
                if (!parsed || !Array.isArray(parsed.zones)) throw new Error("bad payload");
                return parsed;
            });
    }

    function storeData(parsed) {
        try { sessionStorage.setItem(DATA_KEY, JSON.stringify(parsed)); } catch (e) { }
        try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch (e) { }
        window.__ZONE_DATA = parsed;
    }

    window.fzGate = {
        isUnlocked: function () {
            try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch (e) { return false; }
        },
        unlock: function (passcode) {
            return decryptZones(passcode).then(function (parsed) {
                storeData(parsed);
                return true;
            }, function () {
                return false;
            });
        },
        data: function () {
            if (window.__ZONE_DATA) return window.__ZONE_DATA;
            try {
                var raw = sessionStorage.getItem(DATA_KEY);
                if (raw) {
                    var parsed = JSON.parse(raw);
                    window.__ZONE_DATA = parsed;
                    return parsed;
                }
            } catch (e) { }
            return null;
        },
        boot: function (onReady) {
            if (this.data()) {
                onReady();
                return;
            }
            buildLock(onReady);
        }
    };

    function buildLock(onReady) {
        var overlay = document.createElement("div");
        overlay.id = "fz-lock";
        overlay.style.cssText =
            "position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;" +
            "background:linear-gradient(135deg,#0b0e1a,#141a2e);color:#fff;font-family:system-ui,sans-serif;";
        overlay.innerHTML =
            '<div style="max-width:360px;width:90%;text-align:center;padding:32px 24px;border-radius:16px;background:rgba(20,26,46,0.9);border:1px solid rgba(255,255,255,0.1)">' +
            '<img src="WebLogo/Kmoon.webp" alt="" style="width:64px;height:64px;border-radius:14px;margin:0 auto 14px;display:block">' +
            '<h1 style="margin:0 0 6px;font-size:22px">TheFreedomZone</h1>' +
            '<p style="margin:0 0 20px;color:#9aa4bf;font-size:14px">This index is private. Enter the access code your owner shared with you.</p>' +
            '<input type="password" id="fz-lock-input" placeholder="Access code" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#0b0e1a;color:#fff;font-size:16px;text-align:center;box-sizing:border-box;outline:none">' +
            '<div id="fz-lock-error" style="color:#ff5f6d;font-size:13px;min-height:18px;margin:8px 0"></div>' +
            '<button id="fz-lock-btn" style="width:100%;padding:12px;border-radius:8px;border:none;background:#fc2651;color:#fff;font-size:15px;font-weight:600;cursor:pointer">Unlock</button>' +
            '</div>';
        document.body.appendChild(overlay);

        var input = document.getElementById("fz-lock-input");
        var btn = document.getElementById("fz-lock-btn");
        var err = document.getElementById("fz-lock-error");
        if (input) input.focus();

        function attempt() {
            var code = input ? input.value : "";
            if (!code) return;
            err.textContent = "";
            btn.disabled = true;
            window.fzGate.unlock(code).then(function (ok) {
                btn.disabled = false;
                if (ok) {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    onReady();
                } else {
                    err.textContent = "Wrong access code. Try again.";
                    if (input) { input.value = ""; input.focus(); }
                }
            });
        }

        if (btn) btn.addEventListener("click", attempt);
        if (input) input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") attempt();
        });
    }
})();
