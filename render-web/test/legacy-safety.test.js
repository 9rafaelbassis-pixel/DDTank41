const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {snapshot}=require("../game-readiness");
test("readiness never marks legacy engine or original combat as operational",()=>{
 const list=snapshot({});
 const engine=list.find(x=>x.name==="Servidor de jogo C# original");
 const battle=list.find(x=>x.name==="Combate e resultado originais");
 assert.equal(engine.state,"não_integrado");
 assert.equal(battle.state,"não_integrado");
 const socket=list.find(x=>x.name==="Ponte WebSocket/TCP");
 assert.equal(socket.state,"desativada");
});
test("classic Login.ashx no longer has unconditional authorization",()=>{
 const root=path.resolve(__dirname,"..","..");
 const login=fs.readFileSync(path.join(root,"Tank.Request","Login.ashx.cs"),"utf8");
 const setup=fs.readFileSync(path.join(root,"Tank.Request","CreateLogin.aspx.cs"),"utf8");
 assert.ok(login.includes("if (PlayerManager.Login(name, pwd))"));
 assert.doesNotMatch(login,/^\s*if\s*\(true\)\s*$/m);
 assert.ok(setup.includes("if (!ValidLoginIP(Context.Request.UserHostAddress))"));
 assert.ok(setup.includes("!string.IsNullOrWhiteSpace(ips)"));
});
test("PHP launcher config has no committed plain-text database secret",()=>{
 const src=fs.readFileSync(path.resolve(__dirname,"..","..","Source Launcher","api","config.php"),"utf8");
 assert.ok(src.includes("getenv"));
 assert.ok(src.includes("DDTANK_SQL_PASSWORD"));
 assert.ok(src.includes("DDTANK_PAYMENT_PARTNER_KEY"));
 assert.doesNotMatch(src,/define\('DB_PASSWORD',\s*'[^']{3,}'\)/);
});
