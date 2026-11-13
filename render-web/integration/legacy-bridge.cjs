"use strict";
// End-to-end smoke test of the real WebSocket<->TCP byte relay against an
// in-memory TCP echo service. This is NOT the original DDTank game server.
const assert=require("node:assert/strict");
const net=require("node:net");
const http=require("node:http");
const {once}=require("node:events");
const {WebSocket}=require("ws");
const {attachLegacyBridge}=require("../legacy-bridge");
const session="a".repeat(64);
const original={};
for(const k of ["DDTANK_TCP_BRIDGE_ENABLED","DDTANK_FLASH_SOCKET_HOST","DDTANK_FLASH_SOCKET_PORT","DDTANK_TCP_HOST","DDTANK_TCP_PORT","PUBLIC_ORIGIN"])original[k]=process.env[k];
function withTimeout(promise,ms=7000){
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Timeout do teste WS/TCP")),ms)})]).finally(()=>clearTimeout(timer));
}
async function main(){
 const tcp=net.createServer(s=>s.on("data",bytes=>s.write(bytes)));
 tcp.listen(0,"127.0.0.1");
 await withTimeout(once(tcp,"listening"));
 const port=tcp.address().port;
 Object.assign(process.env,{
  DDTANK_TCP_BRIDGE_ENABLED:"true",DDTANK_FLASH_SOCKET_HOST:"127.0.0.1",
  DDTANK_FLASH_SOCKET_PORT:"9500",DDTANK_TCP_HOST:"127.0.0.1",
  DDTANK_TCP_PORT:String(port),PUBLIC_ORIGIN:"https://ddtank-web.onrender.com"
 });
 const server=http.createServer((req,res)=>{res.writeHead(404);res.end()});
 const pool={query:async(statement,params)=>{
  assert.match(statement,/portal_sessions/);
  assert.match(params[0],/^[a-f0-9]{64}$/);
  return {rowCount:1,rows:[{}]};
 }};
 const bridge=attachLegacyBridge(server,pool);
 server.listen(0,"127.0.0.1");
 await withTimeout(once(server,"listening"));
 const url="ws://127.0.0.1:"+server.address().port+"/game-client/socket";
 const tcpConnected=once(tcp,"connection");
 const ws=new WebSocket(url,{headers:{Origin:"https://ddtank-web.onrender.com",Cookie:"ddtank_session="+session}});
 try{
  await withTimeout(Promise.all([once(ws,"open"),tcpConnected]));
  const payload=Buffer.from([0,1,2,3,254,255,42,55,0,64]);
  const got=withTimeout(once(ws,"message"));
  ws.send(payload,{binary:true});
  const [msg,isBinary]=await got;
  assert.equal(isBinary,true);
  assert.deepEqual(Buffer.from(msg),payload);
  console.log("SUCESSO: WebSocket autenticado transportou bytes binários intactos até TCP local e voltou.");
 } finally{
  ws.terminate();
  bridge.close();
  await Promise.allSettled([new Promise(r=>server.close(r)),new Promise(r=>tcp.close(r))]);
  for(const [key,value] of Object.entries(original)) {
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
}
main().catch(err=>{console.error("Falha no teste de transporte WS/TCP:",err.message);process.exitCode=1});
