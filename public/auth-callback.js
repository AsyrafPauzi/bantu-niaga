(function () {
  var statusEl = document.getElementById("auth-callback-status");
  var errEl = document.getElementById("auth-callback-error");
  var linkEl = document.getElementById("auth-callback-signin");

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function fail(text) {
    if (statusEl) statusEl.hidden = true;
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = text;
    }
    if (linkEl) linkEl.hidden = false;
  }

  function go(path) {
    window.location.replace(path);
  }

  try {
    var url = new URL(window.location.href);
    var next = url.searchParams.get("next") || "/accept-invite";
    if (!next.startsWith("/") || next.startsWith("//")) next = "/accept-invite";
    if (
      next.indexOf("/sign-in") === 0 ||
      next.indexOf("/sign-up") === 0 ||
      next.indexOf("/auth/callback") === 0
    ) {
      next = "/accept-invite";
    }

    var oauthError =
      url.searchParams.get("error_description") || url.searchParams.get("error");
    if (oauthError) {
      go("/sign-in?auth_error=" + encodeURIComponent(oauthError));
      return;
    }

    var code = url.searchParams.get("code");
    if (code) {
      setStatus("Confirming sign-in…");
      go(
        "/api/auth/callback/exchange?code=" +
          encodeURIComponent(code) +
          "&next=" +
          encodeURIComponent(next),
      );
      return;
    }

    var hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    var accessToken = hash.get("access_token");
    var refreshToken = hash.get("refresh_token");
    var hashType = hash.get("type");

    if (!accessToken || !refreshToken) {
      go("/sign-in?auth_error=missing_code");
      return;
    }

    setStatus("Opening your invite…");
    window.history.replaceState(null, "", url.pathname + url.search);

    fetch("/api/auth/callback/establish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        next: next,
        type: hashType,
      }),
    })
      .then(function (res) {
        return res.json().then(function (json) {
          return { ok: res.ok, json: json };
        });
      })
      .then(function (result) {
        var target =
          result.json &&
          typeof result.json.redirect === "string" &&
          result.json.redirect.charAt(0) === "/"
            ? result.json.redirect
            : null;
        if (target) {
          go(target);
          return;
        }
        fail(
          (result.json && (result.json.message || result.json.error)) ||
            "Could not open this invite link. Ask your owner for a fresh one.",
        );
      })
      .catch(function () {
        fail(
          "Network error while opening invite. Check your connection and try again.",
        );
      });
  } catch (e) {
    fail(e && e.message ? e.message : "Something went wrong opening this link.");
  }
})();
