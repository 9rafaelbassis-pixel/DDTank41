"use strict";
// Transitional game-auth ticket exchange. This does NOT log the Flash client
// into the original .NET/SQL DDTank; it provides a safe one-time authorization
// mechanism to use ONLY when a trusted legacy backend is actually deployed.
const crypto=require("node:crypto");
const HEX=/^[a-f0-9]{64}$/;
const SECRET_MIN_CHARS=32;
const EXPIRES_SECONDS=120;
const hash=value=>crypto.createHash("sha256").update(value).digest("hex");
const settings=env=>({
 enabled: typeof env.DDTANK_GAME_AUTH_SECRET==="string" && env.DDTANK_GAME_AUTH_SECRET.length>=SECRET_MIN_CHARS,
 key:env.DDTANK_GAME_AUTH_SECRET||""
});
function safeEqual(a,b){
 const x=Buffer.from(a||"","utf8"),y=Buffer.from(b||"","utf8");
 if(!x.length||x.length!==y.length)return false;
 return crypto.timingSafeEqual(x,y);
}
function verifyKey(supplied,env=process.env) {
 const cfg=settings(env);
 return cfg.enabled&&safeEqual(supplied,cfg.key);
}
async function initGameTickets(pool) {
 await pool.query(`CREATE TABLE IF NOT EXISTS portal_game_tickets(
 token_hash CHAR(64) PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
 character_id BIGINT NOT NULL REFERENCES portal_characters(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL)`);
 await pool.query("CREATE INDEX IF NOT EXISTS portal_game_tickets_expires_idx ON portal_game_tickets(expires_at)");
 // Expired tickets may be cleaned on any application startup, without deleting
 // active sessions or any character information.
 await pool.query("DELETE FROM portal_game_tickets WHERE expires_at < NOW()");
}
async function issueTicket(pool,userId) {
 const token=crypto.randomBytes(32).toString("hex");
 const r=await pool.query(`INSERT INTO portal_game_tickets(token_hash,user_id,character_id,expires_at)
 SELECT $1,u.id,c.id,NOW()+INTERVAL '120 seconds'
 FROM portal_users u JOIN portal_characters c ON c.user_id=u.id
 WHERE u.id=$2 RETURNING character_id`,[hash(token),userId]);
 if(!r.rowCount)return null;
 return {ticket:token,expiresInSeconds:EXPIRES_SECONDS,gameServerConnected:false};
}
async function redeemTicket(pool,token) {
 if(!HEX.test(token))return null;
 const r=await pool.query(`WITH claimed AS (
   DELETE FROM portal_game_tickets
   WHERE token_hash=$1 AND expires_at>NOW()
   RETURNING character_id
 ) SELECT c.id AS character_id,c.nickname,c.legacy_user_id
 FROM claimed JOIN portal_characters c ON c.id=claimed.character_id`,[hash(token)]);
 if(!r.rowCount)return null;
 return {characterId:r.rows[0].character_id,nickname:r.rows[0].nickname,
  legacyUserId:r.rows[0].legacy_user_id};
}
function mountTicketRedeemer(app,pool,rateLimit) {
 const limiter=rateLimit({windowMs:60*1000,limit:120,standardHeaders:"draft-7",legacyHeaders:false});
 app.post("/internal/game-auth/redeem",limiter,async(req,res,next)=>{
  res.set("Cache-Control","no-store");
  res.set("X-Content-Type-Options","nosniff");
  if(!settings(process.env).enabled)return res.status(503).json({error:"Integração de jogo não habilitada"});
  // Never log, echo or store the secret. This operation cannot be called
  // by an untrusted Flash client because the key belongs only on the server.
  if(!verifyKey(req.get("X-DDTank-Game-Secret")))return res.status(401).json({error:"Não autorizado"});
  const ticket=typeof req.body?.ticket==="string"?req.body.ticket:"";
  if(!HEX.test(ticket))return res.status(400).json({error:"Ticket inválido"});
  try{
   const data=await redeemTicket(pool,ticket);
   if(!data)return res.status(401).json({error:"Ticket expirado ou utilizado"});
   res.json({...data,exchanged:true});
  }catch(err){next(err)}
 });
}
function mountGameTickets(app,{pool,requireUser,send,csrfField,esc}) {
 app.get("/game-access",requireUser,async(req,res,next)=>{
  try{
   const found=await pool.query("SELECT nickname FROM portal_characters WHERE user_id=$1",[req.user.id]);
   const configured=settings(process.env).enabled;
   const name=found.rows[0]?.nickname;
   const html='<section class="panel"><h1>Conexão segura do jogo original</h1>'+
    '<p>Estamos preparando uma sessão temporária, de uso único, para o servidor clássico. Este recurso <strong>ainda não</strong> conecta o Flash nem inicia batalhas.</p>'+
    '<p><strong>Personagem:</strong> '+(name?esc(name):'não cadastrado')+'</p>'+
    '<p><strong>Servidor legado:</strong> <span class="warn">não conectado</span></p>'+
    '<p><strong>Troca de tickets:</strong> '+(configured?'configurada para desenvolvimento':'desativada até existir backend confiável')+'</p>'+
    (configured&&name?'<p class="muted">A troca de tickets está disponível exclusivamente para integração entre servidores; não digite a senha da conta na tela Flash.</p>':
      '<p class="warn">Nenhuma senha deve ser fornecida ao Launcher antigo. Continue usando o login do portal.</p>')+
    '<a class="btn" href="/character">Meu personagem</a> <a class="btn" href="/game-client">Cliente Flash</a></section>';
   send(res,"Integração do jogo",html,req.user);
  }catch(err){next(err)}
 });
 app.post("/game-access/ticket",requireUser,async(req,res,next)=>{
  res.set("Cache-Control","no-store");
  if(!settings(process.env).enabled)return res.status(503).json({error:"Game Server não configurado"});
  try{
   const ticket=await issueTicket(pool,req.user.id);
   if(!ticket)return res.status(409).json({error:"Crie seu personagem antes de acessar o jogo"});
   res.json(ticket);
  }catch(err){next(err)}
 });
}
module.exports={settings,safeEqual,verifyKey,initGameTickets,issueTicket,redeemTicket,mountTicketRedeemer,mountGameTickets};
