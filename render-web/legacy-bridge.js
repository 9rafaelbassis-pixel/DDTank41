"use strict";
// A fixed-destination authenticated WS<->TCP byte relay for the Flash client's
// legacy socket protocol. Not an emulator. DISABLED unless explicitly configured.
const net=require("node:net");
const crypto=require("node:crypto");
const {WebSocketServer,WebSocket}=require("ws");
const MAX_CONNECTIONS=40;
function configuredBridge(env=process.env) {
 const raw=env.DDTANK_TCP_BRIDGE_ENABLED==="true";
 const flashHost=String(env.DDTANK_FLASH_SOCKET_HOST||"").trim();
 const flashPort=Number(env.DDTANK_FLASH_SOCKET_PORT||9500);
 const tcpHost=String(env.DDTANK_TCP_HOST||"").trim();
 const tcpPort=Number(env.DDTANK_TCP_PORT||9500);
 const validHost=h=>h.length<=253&&/^[a-z0-9][a-z0-9.-]*$/i.test(h)&&!h.includes("..");
 const validPort=p=>Number.isSafeInteger(p)&&p>=1&&p<=65535;
 const valid=raw&&validHost(flashHost)&&validHost(tcpHost)&&validPort(flashPort)&&validPort(tcpPort);
 return {enabled:Boolean(valid),flashHost,flashPort,tcpHost,tcpPort,requested:raw};
}
function flashProxyOptions(env=process.env){
 const settings=configuredBridge(env);
 if(!settings.enabled)return [];
 const origin=new URL(env.PUBLIC_ORIGIN||"https://ddtank-web.onrender.com");
 if(origin.protocol!=="https:")return [];
 return [{host:settings.flashHost,port:settings.flashPort,proxyUrl:"wss://"+origin.host+"/game-client/socket"}];
}
function token(req) {
 const part=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("ddtank_session="));
 return part ? part.slice(15) : "";
}
function reject(socket,code="403 Forbidden"){
 if(socket.destroyed)return;
 socket.write("HTTP/1.1 "+code+"\r\nConnection: close\r\n\r\n");
 socket.destroy();
}
function attachLegacyBridge(server,pool){
 const wss=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
 server.on("upgrade",async(req,socket,head)=>{
   let route;
   try{route=new URL(req.url,"http://127.0.0.1").pathname}catch{return reject(socket,"400 Bad Request")}
   if(route==="/ws/lobby")return; // Lobby has its own, separate handler.
   if(route!=="/game-client/socket")return reject(socket,"404 Not Found");
   const cfg=configuredBridge();
   if(!cfg.enabled)return reject(socket,"503 Service Unavailable");
   let expected;
   try{expected=new URL(process.env.PUBLIC_ORIGIN||"https://ddtank-web.onrender.com").origin}catch{return reject(socket)}
   if(req.headers.origin!==expected)return reject(socket);
   if(wss.clients.size>=MAX_CONNECTIONS)return reject(socket,"503 Service Unavailable");
   const session=token(req);
   if(!/^[a-f0-9]{64}$/.test(session))return reject(socket,"401 Unauthorized");
   try{
     const hash=crypto.createHash("sha256").update(session).digest("hex");
     const user=await pool.query("SELECT 1 FROM portal_sessions WHERE token_hash=$1 AND expires_at>NOW()",[hash]);
     if(!user.rowCount)return reject(socket,"401 Unauthorized");
     if(socket.destroyed)return;
     wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,req,cfg));
   }catch{return reject(socket,"503 Service Unavailable")}
 });
 wss.on("connection",(ws,req,cfg)=>{
   const tcp=net.createConnection({host:cfg.tcpHost,port:cfg.tcpPort});
   tcp.setNoDelay(true);
   tcp.setTimeout(120000);
   let ready=false,closed=false,last=Date.now(),received=0;
   const close=()=>{
     if(closed)return;closed=true;
     tcp.destroy();
     if(ws.readyState===WebSocket.OPEN)ws.close(1000,"Conexão encerrada");
     else if(ws.readyState===WebSocket.CONNECTING)ws.terminate();
   };
   tcp.on("connect",()=>{ready=true});
   tcp.on("data",chunk=>{
     if(ws.readyState!==WebSocket.OPEN)return close();
     try{ws.send(chunk,{binary:true})}catch{close()}
   });
   tcp.on("timeout",close);
   tcp.on("end",close);
   tcp.on("error",close);
   tcp.on("close",close);
   ws.on("message",(buf,isBinary)=>{
     if(!isBinary||!ready)return close();
     const now=Date.now();
     if(now-last>10000){received=0;last=now}
     received+=buf.length;
     if(received>5*1024*1024)return close();
     if(!tcp.write(buf))ws._socket?.pause();
   });
   tcp.on("drain",()=>ws._socket?.resume());
   ws.on("error",close);ws.on("close",close);
 });
 return wss;
}
module.exports={configuredBridge,flashProxyOptions,attachLegacyBridge};
