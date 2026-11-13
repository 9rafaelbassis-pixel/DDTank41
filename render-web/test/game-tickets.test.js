const test=require("node:test");
const assert=require("node:assert/strict");
const {settings,verifyKey,issueTicket,redeemTicket,mountTicketRedeemer,mountGameTickets}=require("../game-tickets");
const secret="0123456789abcdef".repeat(4);
test("tickets disabled until explicit shared secret exists",()=>{
 assert.equal(settings({}).enabled,false);
 assert.equal(settings({DDTANK_GAME_AUTH_SECRET:"short"}).enabled,false);
 assert.equal(settings({DDTANK_GAME_AUTH_SECRET:secret}).enabled,true);
 assert.equal(verifyKey(secret,{DDTANK_GAME_AUTH_SECRET:secret}),true);
 assert.equal(verifyKey("another", {DDTANK_GAME_AUTH_SECRET:secret}),false);
});
test("issues high-entropy time-limited token only for existing character",async()=>{
 let statement="",params=[];
 const pool={query:async(s,p)=>{statement=s;params=p;return {rowCount:1,rows:[{character_id:10}]}}};
 const token=await issueTicket(pool,22);
 assert.match(token.ticket,/^[a-f0-9]{64}$/);
 assert.equal(token.expiresInSeconds,120);
 assert.equal(token.gameServerConnected,false);
 assert.match(statement,/JOIN portal_characters/);
 assert.match(statement,/120 seconds/);
 assert.equal(params[1],22);
 assert.match(params[0],/^[a-f0-9]{64}$/);
 assert.notEqual(params[0],token.ticket);
});
test("refuses to issue token without character",async()=>{
 const token=await issueTicket({query:async()=>({rowCount:0,rows:[]})},4);
 assert.equal(token,null);
});
test("redeems once using atomic SQL delete with expiration",async()=>{
 let query="";
 const pool={query:async(s,p)=>{query=s;return {rowCount:1,rows:[{character_id:10,nickname:"HeróiBR",legacy_user_id:null}]}}};
 const d=await redeemTicket(pool,"a".repeat(64));
 assert.deepEqual(d,{characterId:10,nickname:"HeróiBR",legacyUserId:null});
 assert.match(query,/DELETE FROM portal_game_tickets/);
 assert.match(query,/expires_at>NOW\(\)/);
 assert.equal(await redeemTicket(pool,"invalid"),null);
});
test("disabled machine endpoint does not consume or expose passwords",async()=>{
 const old=process.env.DDTANK_GAME_AUTH_SECRET;delete process.env.DDTANK_GAME_AUTH_SECRET;
 const routes={};
 const app={post:(route,...handlers)=>{routes[route]=handlers}};
 mountTicketRedeemer(app,{query:async()=>{throw Error("disabled endpoint cannot query DB")}},()=>()=>{});
 const fn=routes["/internal/game-auth/redeem"].at(-1);
 let code=0,response=null;
 const res={headers:{},set(n,v){this.headers[n]=v;return this},status(n){code=n;return this},json(v){response=v;return this}};
 try{await fn({get:()=>"",body:{ticket:"a".repeat(64)}},res,()=>{});assert.equal(code,503);assert.equal(response.error,"Integração de jogo não habilitada")}finally{
  if(old!==undefined)process.env.DDTANK_GAME_AUTH_SECRET=old;
 }
});
