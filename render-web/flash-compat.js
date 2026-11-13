"use strict";
// SWF Launcher from the original repository calls localhost:8000 on the
// player's computer. Only exact known paths are rewritten. These same-origin
// endpoints are diagnostic NO-OPs; they never authenticate game credentials.
const ROUTES=Object.freeze([
 {legacy:"/rest-auth/login/",local:"/game-client/compat/rest-auth/login/"},
 {legacy:"/user/api/server-list/",local:"/game-client/compat/user/api/server-list/"},
 {legacy:"/user/api/login2/getlinkflash/",local:"/game-client/compat/user/api/login2/getlinkflash/"}
]);
const RELAY_PATH=ROUTES[0].local;
const RELAY_PATHS=Object.freeze(ROUTES.map(x=>x.local));
const LEGACY_LOGIN_ENDPOINTS=Object.freeze([
 "https://127.0.0.1:8000/rest-auth/login/",
 "http://127.0.0.1:8000/rest-auth/login/"
]);
function authUrlRewriteRules(publicOrigin){
 const parsed=new URL(publicOrigin);
 if(!["https:","http:"].includes(parsed.protocol))throw new Error("invalid public origin");
 return ROUTES.flatMap(({legacy,local})=>
  ["https:","http:"].map(scheme=>[scheme+"//127.0.0.1:8000"+legacy,parsed.origin+local]));
}
function rejectLegacyLogin(req,res){
 res.set("Cache-Control","no-store");
 res.set("X-Content-Type-Options","nosniff");
 res.set("Referrer-Policy","no-referrer");
 return res.status(503).json({
   ok:false,
   code:"GAME_AUTH_BACKEND_UNAVAILABLE",
   message:"Serviços originais do DDTank ainda não integrados. Entre pela conta do portal; não digite senhas nesta tela do jogo."
 });
}
module.exports={ROUTES,RELAY_PATH,RELAY_PATHS,LEGACY_LOGIN_ENDPOINTS,authUrlRewriteRules,rejectLegacyLogin};
