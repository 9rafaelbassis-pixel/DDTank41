"use strict";
// The original Launcher.swf contains a hard-coded local development login URL.
// Ruffle can safely rewrite only that exact obsolete URL to this portal's
// no-op diagnostic endpoint. The endpoint NEVER accepts/authenticates a game
// account or persists a password. It is intentionally not a login bridge.
const LEGACY_LOGIN_ENDPOINTS=Object.freeze([
  "https://127.0.0.1:8000/rest-auth/login/",
  "http://127.0.0.1:8000/rest-auth/login/"
]);
const RELAY_PATH="/game-client/compat/rest-auth/login/";
function authUrlRewriteRules(publicOrigin){
 const parsed=new URL(publicOrigin);
 if(!["https:","http:"].includes(parsed.protocol))throw new Error("invalid public origin");
 return LEGACY_LOGIN_ENDPOINTS.map(url=>[url,parsed.origin+RELAY_PATH]);
}
function rejectLegacyLogin(req,res){
 res.set("Cache-Control","no-store");
 res.set("X-Content-Type-Options","nosniff");
 res.set("Referrer-Policy","no-referrer");
 return res.status(503).json({
   ok:false,
   code:"GAME_AUTH_BACKEND_UNAVAILABLE",
   message:"Login Flash original ainda não integrado. Entre pela conta do portal; não digite senhas nesta tela do jogo."
 });
}
module.exports={LEGACY_LOGIN_ENDPOINTS,RELAY_PATH,authUrlRewriteRules,rejectLegacyLogin};
