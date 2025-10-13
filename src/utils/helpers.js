// ---------------------------
// Helpers
// ---------------------------
export const b64safe = (v, def = "") => {
  try {
    if (!v) return def;
    return Buffer.from(v, "base64").toString("utf-8");
  } catch {
    return def;
  }
};

export const pick = (obj, key, def = "") =>
  obj && obj[key] !== undefined && obj[key] !== null ? obj[key] : def;

