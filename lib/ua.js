export function parseUa(ua = "") {
  if (!ua) return { browser: "", os: "", mobile: false, label: "" };

  let browser = "";
  let bv = "";
  if (/Edg\//.test(ua)) { browser = "Edge"; bv = ua.match(/Edg\/(\d+)/)?.[1] || ""; }
  else if (/OPR\/|Opera/.test(ua)) { browser = "Opera"; bv = ua.match(/(?:OPR|Opera)\/(\d+)/)?.[1] || ""; }
  else if (/Firefox\//.test(ua)) { browser = "Firefox"; bv = ua.match(/Firefox\/(\d+)/)?.[1] || ""; }
  else if (/SamsungBrowser/.test(ua)) { browser = "Samsung Internet"; bv = ua.match(/SamsungBrowser\/(\d+)/)?.[1] || ""; }
  else if (/CriOS\//.test(ua)) { browser = "Chrome"; bv = ua.match(/CriOS\/(\d+)/)?.[1] || ""; }
  else if (/FxiOS\//.test(ua)) { browser = "Firefox"; bv = ua.match(/FxiOS\/(\d+)/)?.[1] || ""; }
  else if (/Chrome\//.test(ua)) { browser = "Chrome"; bv = ua.match(/Chrome\/(\d+)/)?.[1] || ""; }
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) { browser = "Safari"; bv = ua.match(/Version\/(\d+)/)?.[1] || ""; }

  let os = "";
  if (/iPhone|iPad|iPod/.test(ua)) {
    const m = ua.match(/OS (\d+[_\d]*)/);
    os = "iOS" + (m ? " " + m[1].replace(/_/g, ".") : "");
    if (/iPad/.test(ua)) os = "iPadOS" + os.slice(3);
  } else if (/Android/.test(ua)) {
    os = "Android " + (ua.match(/Android (\d+(?:\.\d+)?)/)?.[1] || "");
  } else if (/Windows NT/.test(ua)) {
    const v = ua.match(/Windows NT ([\d.]+)/)?.[1];
    os = "Windows " + ({ "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" }[v] || v || "");
  } else if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/)?.[1];
    os = "macOS" + (m ? " " + m.replace(/_/g, ".") : "");
  } else if (/CrOS/.test(ua)) {
    os = "ChromeOS";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  const mobile = /Mobile|iPhone|iPad|Android/.test(ua);
  const browserStr = bv ? `${browser} ${bv}` : browser;
  const label = [os, browserStr].filter(Boolean).join(" · ");
  return { browser: browserStr.trim(), os: os.trim(), mobile, label };
}
