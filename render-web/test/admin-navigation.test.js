"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { adminAccess, afterLogin } = require("../admin-navigation");
test("admin link allows guests to find the login without granting access", () => {
  assert.deepEqual(adminAccess(null), { status: "login", url: "/login?area=admin" });
});
test("players cannot enter admin routes", () => {
  assert.deepEqual(adminAccess({ id: 3, role: "player" }), { status: "forbidden" });
  assert.equal(afterLogin({ role: "player" }), "/dashboard");
});
test("verified administrators enter their panel directly after login", () => {
  assert.deepEqual(adminAccess({ id: 1, role: "admin" }), { status: "allow" });
  assert.equal(afterLogin({ role: "admin" }), "/admin");
});
test("unexpected roles do not get admin entry", () => {
  assert.equal(adminAccess({ role: "root" }).status, "forbidden");
  assert.equal(afterLogin({ role: "root" }), "/dashboard");
});
