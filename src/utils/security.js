import fs from "fs";

// ===== Config =====
// ===== Helpers (ported from PHP) =====
export function isHttpsRequest(req) {
  return req.secure || req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
}


export function check_agent_validation(agent = "") {
  const bad_keys = [
    "bot",
    "python",
    "carbon",
    "github",
    "HeadlessChrome",
    "APIs-Google",
    "Mediapartners-Google",
    "Googlebot",
    "AdsBot",
    "FeedFetcher-Google",
    "crawlers",
    "DuplexWeb-Google",
    "Storebot-Google",
    "naver.me",
  ];
  const lower = (agent || "").toLowerCase();
  return !bad_keys.some(k => lower.includes(k.toLowerCase()));
}

export function check_clientip_validation(client_ip = "") {
  const black_ip_list = [
    "63.88.73.", "63.117.14.", "191.96.180.", "146.190.13.", "159.203.53.", "190.103.176.", "82.118.30.",
    "167.250.111.", "154.30.116.", "185.220.101.", "45.128.199.", "104.165.199.", "104.164.195.",
    "204.8.96.", "45.67.97.", "89.208.29.", "1.254.179.", "211.117.24.", "216.46.132.", "182.162.206.",
    "67.50.19.", "132.198.200.", "67.61.40.", "65.154.226.", "91.193.157.", "65.154.226.", "24.220.112.",
    "64.184.109.", "209.131.254.", "67.215.19.", "63.117.215.", "199.250.251.", "112.76.137.", "182.172.56.",
    "173.44.117.", "1.225.35.", "220.230.168.", "211.249.40.", "211.249.68.", "35.243.23.", "1.225.35.",
    "1.255.2.", "104.222.43.", "112.197.8.", "162.252.127.", "220.65.183.",
  ];
  return !black_ip_list.some(prefix => String(client_ip).includes(prefix));
}

export function dropFirstPathSegment(originalUrl) {
  const first = originalUrl.indexOf("/");
  const second = originalUrl.indexOf("/", first + 1);
  return second >= 0 ? originalUrl.slice(second) : "/";
}

// Simple POST forwarder using Node's http module
export function forwardJsonPost(urlStr, jsonBody) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const data = Buffer.from(JSON.stringify(jsonBody ?? {}));

    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + (u.search || ""),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
      },
      res => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", chunk => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}


