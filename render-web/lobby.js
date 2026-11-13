"use strict";
// Authenticated WebSocket waiting room. This is a *real network lobby*,
// NOT the original DDTank binary battle protocol or an implemented battle.
const { WebSocketServer, WebSocket } = require("ws");
const crypto = require("node:crypto");
const {startBattle,shoot}=require("./battle");
const battles=new Map();
const MAX_USERS = 80;
const rooms = new Map();
function cookieToken(req) {
  const field = (req.headers.cookie || "").split(";").map(v => v.trim())
    .find(v => v.startsWith("ddtank_session="));
  return field ? field.slice("ddtank_session=".length) : "";
}
function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function presence(room) {
  const peers = rooms.get(room);
  if (!peers) return;
  const event = { type:"presence",room,players:[...peers].map(p=>({id:p.user.id,display:p.user.name||"Jogador #"+p.user.id})), capacity:2 };
  for (const peer of peers) send(peer,event);
}
function leave(ws) {
  const room = ws.room;
  if (!room) return;
  battles.delete(room);
  const peers = rooms.get(room);
  if (peers) {
    peers.delete(ws);
    if (peers.size) presence(room); else rooms.delete(room);
  }
  ws.room = null;
}
function onMessage(ws, data) {
  const now=Date.now();
  if(now-ws.lastWindow>5000){ws.lastWindow=now;ws.count=0}
  if(++ws.count>12){send(ws,{type:"error",message:"Limite de mensagens atingido."});return}
  let msg;
  try {msg=JSON.parse(String(data))}catch{return send(ws,{type:"error",message:"Mensagem inválida."})}
  if(!msg||typeof msg!=="object")return;
  if(msg.type==="join") {
    const room=String(msg.room||"").trim().toUpperCase();
    if(!/^[A-Z0-9_-]{3,16}$/.test(room)) return send(ws,{type:"error",message:"Sala: 3 a 16 caracteres (letras, números, _ ou -)."});
    if(ws.room===room)return presence(room);
    const peers=rooms.get(room)||new Set();
    if(peers.size>=2)return send(ws,{type:"error",message:"Sala cheia (2 jogadores)."});
    if([...peers].some(p=>p.user.id===ws.user.id))return send(ws,{type:"error",message:"Você já está nessa sala em outra aba."});
    leave(ws);
    ws.room=room;
    peers.add(ws);rooms.set(room,peers);
    send(ws,{type:"joined",room,message:"Conectado à sala. A batalha original ainda não foi integrada."});
    presence(room);
    if(peers.size===2){
      const users=[...peers].map(p=>p.user);
      if(users.some(u=>!u.name))for(const p of peers)send(p,{type:"error",message:"Para testar disparos, as duas contas precisam criar personagem em /character."});
      else {
        const battle=startBattle(users);battles.set(room,battle);
        for(const p of peers)send(p,{type:"battle-state",battle});
      }
    }
    return;
  }
  if(msg.type==="shoot") {
    if(!ws.room)return send(ws,{type:"error",message:"Entre em uma sala."});
    const battle=battles.get(ws.room);
    if(!battle)return send(ws,{type:"error",message:"Ainda não há batalha de teste. São necessários dois personagens."});
    let result;
    try{result=shoot(battle,ws.user.id,Number(msg.angle),Number(msg.power))}catch(err){return send(ws,{type:"error",message:err.message})}
    for(const p of rooms.get(ws.room)||[])send(p,{type:"battle-shot",result});
    return;
  }
  if(msg.type==="chat") {
    const message=typeof msg.text==="string"?msg.text.trim():"";
    if(!ws.room)return send(ws,{type:"error",message:"Entre em uma sala primeiro."});
    if(!message||message.length>180)return send(ws,{type:"error",message:"Mensagem precisa ter de 1 a 180 caracteres."});
    for(const peer of (rooms.get(ws.room)||[]))send(peer,{type:"chat",sender:ws.user.name||"Jogador #"+ws.user.id,text:message});
    return;
  }
  if(msg.type==="leave"){leave(ws);send(ws,{type:"left"});return}
  send(ws,{type:"error",message:"Comando não suportado."});
}
function reject(socket, status) {
  socket.write("HTTP/1.1 "+status+"\r\nConnection: close\r\n\r\n");
  socket.destroy();
}
function attachLobbyServer(server,pool) {
  const wss = new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
  server.on("upgrade",async(req,socket,head)=>{
    try {
      const url = new URL(req.url,"http://localhost");
      if(url.pathname!=="/ws/lobby")return reject(socket,"404 Not Found");
      const origin=req.headers.origin;
      const canonical=new URL(process.env.PUBLIC_ORIGIN||"https://ddtank-web.onrender.com").origin;
      if(origin!==canonical)return reject(socket,"403 Forbidden");
      if(wss.clients.size>=MAX_USERS)return reject(socket,"503 Service Unavailable");
      const token=cookieToken(req);
      if(!/^[a-f0-9]{64}$/.test(token))return reject(socket,"401 Unauthorized");
      const tokenHash=crypto.createHash("sha256").update(token).digest("hex");
      const result=await pool.query("SELECT u.id,c.nickname FROM portal_sessions s JOIN portal_users u ON u.id=s.user_id LEFT JOIN portal_characters c ON c.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>NOW()",[tokenHash]);
      if(!result.rowCount)return reject(socket,"401 Unauthorized");
      const user={id:result.rows[0].id,name:result.rows[0].nickname||null};
      wss.handleUpgrade(req,socket,head,(ws)=>wss.emit("connection",ws,req,user));
    } catch(error) {if(!socket.destroyed)reject(socket,"500 Internal Server Error")}
  });
  wss.on("connection",(ws,req,user)=>{
    ws.user=user;ws.room=null;ws.lastWindow=Date.now();ws.count=0;ws.alive=true;
    send(ws,{type:"hello",message:"Lobby online: teste de tiro simplificado, sem integração com o motor original do DDTank 4.1."});
    ws.on("message",(data)=>onMessage(ws,data));
    ws.on("pong",()=>{ws.alive=true});
    ws.on("close",()=>leave(ws));
    ws.on("error",()=>leave(ws));
  });
  const interval=setInterval(()=>{
    for(const ws of wss.clients) {
      if(!ws.alive){ws.terminate();continue}
      ws.alive=false;ws.ping();
    }
  },30000);
  interval.unref();
  wss.on("close",()=>clearInterval(interval));
  return wss;
}
function lobbyHtml() {
  return `<section class="panel"><h1>Salas multiplayer — teste de conexão</h1>
  <p><strong>Atenção:</strong> tiro e dano abaixo são um protótipo físico separado do DDTank 4.1. Não são os mapas, regras nem o motor original. Ambas as contas devem criar personagens em <a href="/character">/character</a>.</p>
  <div class="chip" id="status">Conectando...</div>
  <div class="grid">
   <div><label>Nome da sala<input id="room" maxlength="16" value="TESTE01"></label><button type="button" id="join">Entrar na sala</button></div>
   <div><p id="players">Nenhum jogador conectado</p></div>
  </div>
  <hr style="border:0;border-top:1px solid #355180;margin:20px 0">
  <div id="messages" aria-live="polite" style="height:220px;overflow:auto;background:#08152d;padding:14px;border-radius:10px"></div>
  <section class="panel" style="margin-top:18px"><h2>Teste de tiro (2 jogadores)</h2><p id="battleStatus">Sem batalha iniciada.</p><form id="shot"><label>Ângulo (0–85°)<input id="angle" type="number" min="0" max="85" value="45" required></label><label>Força (1–100)<input id="power" type="number" min="1" max="100" value="78" required></label><button>Atirar</button></form></section>
  <form id="chat"><label>Mensagem<input id="text" maxlength="180" autocomplete="off" placeholder="Digite uma mensagem"></label><button>Enviar</button></form>
  <p class="muted">As salas são temporárias e desaparecem quando o servidor reinicia. Duas contas diferentes são necessárias para testar.</p>
  </section><script>
  (function(){
    const el=id=>document.getElementById(id);
    const socket=new WebSocket((location.protocol==="https:"?"wss:":"ws:")+"//"+location.host+"/ws/lobby");
    function log(message){const item=document.createElement("p");item.textContent=message;el("messages").appendChild(item);el("messages").scrollTop=el("messages").scrollHeight}
    function emit(msg){if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(msg));else log("Aguarde a conexão.")}
    socket.onopen=()=>{el("status").textContent="Conectado";log("WebSocket conectado. Escolha uma sala.");};
    socket.onclose=()=>{el("status").textContent="Desconectado";log("Conexão encerrada. Recarregue a página.");};
    socket.onerror=()=>{log("Falha no WebSocket. Confira o deploy e seu login.");};
    socket.onmessage=(ev)=>{let msg;try{msg=JSON.parse(ev.data)}catch{return}
      if(msg.type==="hello"||msg.type==="joined"||msg.type==="error")log(msg.message);
      else if(msg.type==="presence"){el("players").textContent=msg.room+": "+msg.players.map(p=>p.display).join(" e ")+" ("+msg.players.length+"/2)";}
      else if(msg.type==="battle-state"){el("battleStatus").textContent="Batalha de teste iniciada: "+msg.battle.players.map(p=>p.name+" (100 HP)").join(" × ")+" | Vez: "+msg.battle.turn;}
      else if(msg.type==="battle-shot"){const s=msg.result;el("battleStatus").textContent=s.players.map(p=>p.name+": "+p.hp+" HP").join(" | ")+" | Vez: "+s.turn;log("Disparo: ângulo "+s.angle+"°, força "+s.power+", posição "+s.landing+", dano "+s.damage+"."+(s.winner?" Vencedor #"+s.winner:""));}
      else if(msg.type==="chat")log(msg.sender+": "+msg.text);
      else if(msg.type==="left")el("players").textContent="Você saiu da sala.";
    };
    el("join").onclick=()=>emit({type:"join",room:el("room").value});
    el("shot").onsubmit=ev=>{ev.preventDefault();emit({type:"shoot",angle:Number(el("angle").value),power:Number(el("power").value)})};
    el("chat").onsubmit=ev=>{ev.preventDefault();if(el("text").value.trim()){emit({type:"chat",text:el("text").value});el("text").value=""}};
  })();
  </script>`;
}
module.exports={attachLobbyServer,lobbyHtml};
