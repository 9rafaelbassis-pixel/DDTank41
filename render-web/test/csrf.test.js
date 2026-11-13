const test = require("node:test");
const assert = require("node:assert/strict");
const csrf = require("../csrf");

function invoke(method, cookie = "", body = {}) {
  let nextCalled = false, status = 200, html = "", setCookie = [];
  const req = { path: "/login", method, body, headers: { cookie } };
  const res = {
    locals: {},
    set() { return this; },
    cookie(name, value, options) { setCookie.push({ name, value, options }); return this; },
    status(code) { status = code; return this; },
    type() { return this; },
    send(body) { html = body; return this; }
  };
  csrf(req, res, () => { nextCalled = true; });
  return { nextCalled, status, html, setCookie, token: res.locals.csrfToken };
}
test("GET issues secure same-site token cookie", () => {
  const response = invoke("GET");
  assert.equal(response.nextCalled, true);
  assert.match(response.token, /^[a-f0-9]{64}$/);
  assert.equal(response.setCookie[0].name, "ddtank_csrf");
  assert.equal(response.setCookie[0].options.httpOnly, true);
  assert.equal(response.setCookie[0].options.sameSite, "lax");
});
test("POST with token from cookie and matching form field passes", () => {
  const token = invoke("GET").token;
  assert.equal(invoke("POST", "ddtank_csrf=" + token, { _csrf: token }).nextCalled, true);
});
test("POST without token cannot submit", () => {
  const result = invoke("POST", "", {});
  assert.equal(result.status, 403);
  assert.equal(result.nextCalled, false);
});
test("POST with mismatched token cannot submit", () => {
  const token = invoke("GET").token;
  const result = invoke("POST", "ddtank_csrf=" + token, { _csrf: "x".repeat(64) });
  assert.equal(result.status, 403);
  assert.equal(result.nextCalled, false);
});
test("GET reuses valid cookie token", () => {
  const token = invoke("GET").token;
  const result = invoke("GET", "ddtank_csrf=" + token);
  assert.equal(result.token, token);
  assert.equal(result.setCookie.length, 0);
});
