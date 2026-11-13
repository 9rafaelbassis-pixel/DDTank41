"use strict";
// Admin-only Flash compatibility experiment; not a playable game or battle engine.
// Only explicitly allowlisted SWFs from this user's repository can be fetched.
const ALLOWED=new Set(["Launcher.swf","Loading.swf","DDT_Loading.swf"]);
const express=require("express");
const path=require("node:path");
function mountPreview(app,{requireAdmin,send}) {
 app.use("/admin/ruffle",requireAdmin,express.static(path.join(__dirname,"node_modules","@ruffle-rs","ruffle"),{fallthrough:false}));
 app.get("/admin/client-preview",requireAdmin,(req,res)=>{
  const html='<section class="panel"><h1>Cliente Flash original — diagnóstico</h1>'+
   '<p>Teste experimental com Ruffle. Os arquivos abaixo são SWFs originais do seu repositório; não foram convertidos em jogo HTML5. A comunicação de batalha e os recursos externos ainda não estão integrados.</p>'+
   '<p>Selecione <a href="/admin/flash-asset/Launcher.swf">Launcher.swf</a>, <a href="/admin/flash-asset/Loading.swf">Loading.swf</a> ou <a href="/admin/flash-asset/DDT_Loading.swf">DDT_Loading.swf</a>.</p>'+
   '<label>Arquivo SWF<select id="movie" style="display:block;background:#08142a;color:white;padding:12px;margin:12px 0"><option>Launcher.swf</option><option>Loading.swf</option><option>DDT_Loading.swf</option></select></label>'+
   '<button type="button" id="play">Carregar no Ruffle</button>'+
   '<p class="warn" id="notice">Usaremos Ruffle somente como diagnóstico, com chamadas externas bloqueadas.</p>'+
   '<div id="flash" style="min-height:430px;background:#03080f;border:1px solid #41618e;border-radius:12px;margin-top:18px"></div>'+
   '</section><script src="/admin/ruffle/ruffle.js"></script>'+
   '<script>(function(){document.getElementById("play").onclick=async function(){'+
     'const notice=document.getElementById("notice"),mount=document.getElementById("flash");mount.replaceChildren();'+
     'try{if(!window.RufflePlayer)throw Error("Ruffle não carregou.");'+
     'const ruffle=window.RufflePlayer.newest(),player=ruffle.createPlayer();'+
     'player.style.width="100%";player.style.height="430px";mount.appendChild(player);'+
     'await player.ruffle().load({url:"/admin/flash-asset/"+document.getElementById("movie").value,allowNetworking:"none",openUrlMode:"deny"});'+
     'notice.textContent="Arquivo solicitado. Verifique o visual e eventuais erros do Ruffle.";}catch(e){notice.textContent="Falha na compatibilidade: "+e.message}}})();</script>';
  send(res,"Teste Flash",html,req.user);
 });
 app.get("/admin/flash-asset/:name",requireAdmin,async(req,res,next)=>{
  const name=req.params.name;
  if(!ALLOWED.has(name))return res.status(404).send("Arquivo não permitido");
  try{
   const remote="https://raw.githubusercontent.com/9rafaelbassis-pixel/DDTank41/main/Source%20Flash/FlashSV1/"+name;
   const upstream=await fetch(remote,{signal:AbortSignal.timeout(12000)});
   if(!upstream.ok)return res.status(502).send("SWF indisponível no GitHub");
   const size=Number(upstream.headers.get("content-length")||0);
   if(size>3000000)return res.status(413).send("SWF acima do limite");
   const buffer=Buffer.from(await upstream.arrayBuffer());
   if(buffer.length>3000000)return res.status(413).send("SWF acima do limite");
   const signature=buffer.toString("ascii",0,3);
   if(!["FWS","CWS","ZWS"].includes(signature))return res.status(502).send("Arquivo não é SWF");
   res.set("X-Content-Type-Options","nosniff");
   res.type("application/x-shockwave-flash").send(buffer);
  }catch(err){next(err)}
 });
}
module.exports={mountPreview};
