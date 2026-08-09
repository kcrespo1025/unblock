// TheFreedomZone catalog loader: fetches the plaintext zone catalog
// (zones.json) and exposes it in-memory. No access code required.
(function () {
    "use strict";

    var BLOB_URL = "javascript/zones.json";
    var DATA_KEY = "fz_data";

    function fetchZones() {
        return fetch(BLOB_URL, { cache: "no-cache" })
            .then(function (res) {
                if (!res.ok) throw new Error("blob " + res.status);
                return res.json();
            })
            .then(function (parsed) {
                if (!parsed || !Array.isArray(parsed.zones)) throw new Error("bad payload");
                return parsed;
            });
    }

    function storeData(parsed) {
        try { sessionStorage.setItem(DATA_KEY, JSON.stringify(parsed)); } catch (e) { }
        window.__ZONE_DATA = parsed;
    }

    window.fzGate = {
        isUnlocked: function () { return true; },
        unlock: function () {
            return fetchZones().then(function (parsed) {
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
            fetchZones().then(function (parsed) {
                storeData(parsed);
                onReady();
            }, function () {
                onReady();
            });
        }
    };
})();
