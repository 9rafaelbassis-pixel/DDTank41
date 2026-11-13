"use strict";
// Double-submit CSRF protection that works behind Render's reverse proxy.
// Browsers receive a host-only, HttpOnly, SameSite=Lax cookie on GET requests.
// HTML forms must submit the matching hidden _csrf field. No Origin/Host
// comparison is required, and cross-site pages cannot read this cookie/token.
const crypto = require("node:crypto");
const COOKIE = "ddtank_csrf";
const TOKEN_REGEX = /^[a-f0-9]{64}$/;
const DAYS_7 = 7 * 24 * 60 * 60 * 1000;
const cookieOpts = {
  httpOnly: true, sameSite: "lax", path: "/",
  secure: process.env.NODE_ENV === "production", maxAge: DAYS_7
};
function getCookie(req) {
  const field = (req.headers.cookie || "").split(";")
    .map(v => v.trim()).find(v => v.startsWith(COOKIE + "="));
  return field ? field.slice(COOKIE.length + 1) : "";
}
function match(a, b) {
  if (!TOKEN_REGEX.test(a) || !TOKEN_REGEX.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
module.exports = function csrf(req, res, next) {
  if (req.path === "/health") return next();
  res.set("Cache-Control", "no-store");
  const cookieToken = getCookie(req);
  if (req.method === "GET" || req.method === "HEAD") {
    const token = TOKEN_REGEX.test(cookieToken) ? cookieToken : crypto.randomBytes(32).toString("hex");
    if (token !== cookieToken) res.cookie(COOKIE, token, cookieOpts);
    res.locals.csrfToken = token;
    return next();
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const supplied = req.body && typeof req.body._csrf === "string" ? req.body._csrf : "";
    if (!match(cookieToken, supplied)) {
      return res.status(403).type("html").send(
        '<!doctype html><html lang="pt-BR"><meta charset="utf-8">' +
        '<title>Sessão do formulário expirada</title>' +
        '<h1>Não foi possível validar o formulário</h1>' +
        '<p>Abra a página de login novamente e envie o formulário atualizado.</p>' +
        '<p><a href="/login">Ir para o login</a></p></html>'
      );
    }
  }
  next();
};
