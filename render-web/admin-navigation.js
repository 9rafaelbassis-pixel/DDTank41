"use strict";
// Admin access always requires a server-verified role; the public entry link
// only makes the route discoverable and never elevates a player account.
function adminAccess(user) {
  if (!user) return { status: "login", url: "/login?area=admin" };
  if (user.role !== "admin") return { status: "forbidden" };
  return { status: "allow" };
}
function afterLogin(user) {
  return user && user.role === "admin" ? "/admin" : "/dashboard";
}
module.exports = { adminAccess, afterLogin };
