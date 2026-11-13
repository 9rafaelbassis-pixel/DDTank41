"use strict";
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const manifest=require("./legacy-assets-manifest.json");
const {configuredBridge,flashProxyOptions}=require("./legacy-bridge");
const {authUrlRewriteRules}=require("./flash-compat");
const PTBR_MANUAL=require("./locale/manual-ptbr-overrides.json");
const MAX_FILE_BYTES=8000000;
const MAX_CACHE_BYTES=24000000;
const cache=new Map();
const inFlight=new Map();
let cacheBytes=0;
const BASE="/game-client/files/";
const FILES=manifest.files;
const BROWSER_PUBLIC_URL="/game-client";
const PTBR_LOCALE=path.join(__dirname,"locale","flash-ui-language.ptbr.txt");
function ptBrLocaleActive(){return process.env.DDTANK_FLASH_PTBR!=="false" && fs.existsSync(PTBR_LOCALE)}
function applyPtBrOverrides(data){
 const source=Buffer.isBuffer(data)?data.toString("utf8"):String(data);
 return Buffer.from(source.split("\n").map(line=>{
  const at=line.indexOf(":");
  if(at<0)return line;
  const key=line.slice(0,at).replace(/^\uFEFF/,"");
  if(!Object.hasOwn(PTBR_MANUAL,key))return line;
  return line.slice(0,at+1)+PTBR_MANUAL[key]+(line.endsWith("\r")?"\r":"");
 }).join("\n"),"utf8");
}

function allowedPath(path) {
  return typeof path==="string" && Object.hasOwn(FILES,path) && !path.includes("\\") && !path.includes("\0")
   && !path.split("/").some(part=>part==="."||part==="..");
}
function gitBlobSha(buffer) {
  const tag=Buffer.from("blob "+buffer.length+"\0");
  return crypto.createHash("sha1").update(tag).update(buffer).digest("hex");
}
function putCache(name,data) {
  if(data.length>MAX_CACHE_BYTES)return;
  while(cacheBytes+data.length>MAX_CACHE_BYTES && cache.size>0){
    const [name,existing]=cache.entries().next().value;
    cache.delete(name);cacheBytes-=existing.length;
  }
  if(cache.has(name)){cacheBytes-=cache.get(name).length;cache.delete(name)}
  cache.set(name,data);cacheBytes+=data.length;
}
async function getAsset(name) {
  if(!allowedPath(name))throw Object.assign(new Error("Recurso não autorizado"),{status:404});
  if(cache.has(name))return cache.get(name);
  if(inFlight.has(name))return inFlight.get(name);
  const work=(async()=>{
    const entry=FILES[name];
    const segments=name.split("/").map(encodeURIComponent).join("/");
    const repo="https://raw.githubusercontent.com/9rafaelbassis-pixel/DDTank41/";
    const source=repo+manifest.generatedFromCommit+"/Source%20Flash/FlashSV1/"+segments;
    const response=await fetch(source,{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Object.assign(new Error("Recurso indisponível no GitHub"),{status:502});
    if(Number(response.headers.get("content-length")||0)>MAX_FILE_BYTES)throw Object.assign(new Error("Arquivo acima do limite"),{status:413});
    const buffer=Buffer.from(await response.arrayBuffer());
    if(buffer.length!==entry.size || buffer.length>MAX_FILE_BYTES || gitBlobSha(buffer)!==entry.sha){
      throw Object.assign(new Error("O recurso do GitHub não corresponde ao manifesto aprovado"),{status:502});
    }
    if(name.endsWith(".swf") && !["FWS","CWS","ZWS"].includes(buffer.toString("ascii",0,3))){
      throw Object.assign(new Error("Assinatura SWF inválida"),{status:502});
    }
    putCache(name,buffer);
    return buffer;
  })();
  inFlight.set(name,work);
  try{return await work}finally{inFlight.delete(name)}
}
function xmlEsc(value) {
 return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
}
function safeConfig(original,origin) {
  let parsedOrigin;
  try{parsedOrigin=new URL(origin);if(parsedOrigin.protocol!=="https:" && process.env.NODE_ENV==="production")throw Error("HTTPS");}
  catch{throw new Error("Origem pública inválida")}
  let xml=String(original);
  // Scrub external navigation/calls in every attribute. Avoid sharing legacy credentials
  // with ancient domains; the Ruffle test is limited to same-origin assets only.
  xml=xml.replace(/(\w+)=(["'])(https?:\/\/[^"']*)\2/gi,(_,attr,quote)=>attr+"="+quote+quote);
  const update=(tag,value)=>{
    const regexp=new RegExp("(<"+tag+"\\b[^>]*\\bvalue=)([\"'])[^\"']*\\2","i");
    if(!regexp.test(xml))throw new Error("Configuração Flash não tem campo "+tag);
    xml=xml.replace(regexp,(_,lead,quote)=>lead+quote+xmlEsc(value)+quote);
  };
  const root=parsedOrigin.origin;
  for(const k of ["FLASHSITE","BACKUP_FLASHSITE","SITE","WEEKLYSITE"])update(k,root+BASE);
  for(const k of ["FIRSTPAGE","REGISTER","LOGIN_PATH"])update(k,root+BROWSER_PUBLIC_URL);
  update("REQUEST_PATH",root+"/game-client/request-unavailable/");
  update("FILL_PATH",root+"/game-client/payments-unavailable/");
  update("USE_MD5","false");
  // Keep "vietnam" path for asset lookup; filenames must remain unchanged,
  // even when the actual text bundles are translated later.
  update("LANGUAGE","vietnam");
  // Remove legacy socket policy files: no raw TCP game server is enabled yet.
  xml=xml.replace(/<POLICY_FILES>[\s\S]*?<\/POLICY_FILES>/i,"<POLICY_FILES />");
  return xml;
}
function contentType(path){
 if(path.endsWith(".swf"))return "application/x-shockwave-flash";
 if(path.endsWith(".xml"))return "application/xml; charset=utf-8";
 if(path.endsWith(".txt"))return "text/plain; charset=utf-8";
 if(path.endsWith(".png"))return "image/png";
 if(path.endsWith(".jpg")||path.endsWith(".jpeg"))return "image/jpeg";
 if(path.endsWith(".gif"))return "image/gif";
 return "application/octet-stream";
}
function clientHtml(socketOptions=[],rewriteRules=authUrlRewriteRules(process.env.PUBLIC_ORIGIN||"https://ddtank-web.onrender.com")) {
  const list=["Launcher.swf","Loading.swf","DDT_Loading.swf","ui/vietnam/swf/_corei.swf"];
  const choices=list.filter(allowedPath).map(x=>'<option value="'+x+'">'+x+'</option>').join("");
  return '<section class="panel"><h1>DDTank clássico — laboratório Flash</h1>'+
    '<p>Reproduz os arquivos SWF existentes na sua base usando Ruffle e recursos originais. O <strong>servidor do jogo, autenticação Flash, mapa e combate originais ainda não estão conectados</strong>.</p>'+
    '<p class="warn" style="border:1px solid #af8640;border-radius:9px;padding:12px"><strong>Login do Flash em manutenção:</strong> a janela antiga ainda não autentica sua conta. NÃO digite senhas nos campos desenhados pelo jogo. Use o acesso já existente ao portal. O endereço antigo 127.0.0.1 é bloqueado e redirecionado apenas a um diagnóstico seguro.</p><p><small>Traduções da tela: Tài khoản = Conta; Mật khẩu = Senha; CHƠI NGAY = JOGAR AGORA.</small></p><p><a class="btn" href="/character">Meu personagem</a> <a class="btn" href="/inventory">Inventário do portal</a> <a class="btn" href="/lobby">Salas de teste</a></p>'+
    '<p class="chip" id="stage">249 recursos originais autorizados • carregador de teste</p><p class="muted">Idioma do cliente: PT-BR experimental quando instalado; arquivo vietnamita original preservado para recuperação.</p>'+
    '<label>Arquivo inicial<select id="movie" style="display:block;margin:10px 0;padding:12px;background:#08142a;border:1px solid #41618e;border-radius:8px;color:white;max-width:100%">'+choices+'</select></label>'+
    '<button type="button" id="startFlash">Abrir o cliente original</button> '+
    '<button type="button" class="outline" id="checkAssets">Conferir arquivos</button>'+
    '<div id="screen" style="min-height:520px;margin-top:18px;border-radius:12px;border:1px solid #41618e;background:#01040d;overflow:hidden"></div>'+
    '<p id="flashStatus" role="status" class="muted">O carregamento só começa quando você clica no botão. Conexões com serviços externos estão bloqueadas.</p>'+
    '<details><summary>Detalhes técnicos</summary><p>O repositório contém Flash ActionScript, com vários recursos da pasta ui/vietnam. O carregador serve os arquivos do GitHub por HTTPS com manifesto de hashes. O navegador ainda não tem acesso ao antigo servidor TCP em 9500; o Ruffle não substitui esse backend.</p><p>Este módulo não altera contas nem inventários e não envia nenhuma credencial ao cliente antigo.</p></details></section>'+
    '<script src="/game-client/ruffle/ruffle.js"></script>'+
    '<script>(function(){'+
    'var status=document.getElementById("flashStatus"),screen=document.getElementById("screen");'+
    'document.getElementById("checkAssets").onclick=async function(){try{var r=await fetch("/game-client/files/Launcher.swf",{method:"HEAD"});status.textContent="Launcher.swf: HTTP "+r.status+"; tamanho: "+r.headers.get("content-length")+" bytes.";}catch(e){status.textContent=e.message}};'+
    'document.getElementById("startFlash").onclick=async function(){screen.replaceChildren();try{'+
    'if(!window.RufflePlayer)throw Error("Ruffle não foi carregado.");'+
    'status.textContent="Carregando SWF e dependências originais...";'+
    'var r=window.RufflePlayer.newest(),player=r.createPlayer();'+
    'player.style.width="100%";player.style.height="520px";screen.appendChild(player);'+
    'await player.ruffle().load({url:"/game-client/files/"+document.getElementById("movie").value,'+
    'base:location.origin+"/game-client/files/",allowNetworking:"internal",openUrlMode:"deny",socketProxy:'+JSON.stringify(socketOptions)+',urlRewriteRules:'+JSON.stringify(rewriteRules)+'});'+
    'status.textContent="SWF carregado pelo Ruffle. Isso não significa conexão com o jogo original; verifique recursos e o console do navegador."'+
    '}catch(e){status.textContent="Falha ao carregar: "+e.message}}'+
    '})();</script>';
}
function mountOriginalClient(app,{requireUser,send}) {
  // Keep Ruffle local: no third-party JS is executed in an authenticated browser session.
  const express=require("express");
  const path=require("node:path");
  app.use("/game-client/ruffle",requireUser,express.static(path.join(__dirname,"node_modules","@ruffle-rs","ruffle"),{fallthrough:false}));
  app.get("/game-client",requireUser,(req,res)=>{
    const websocketOrigin=new URL(process.env.PUBLIC_ORIGIN||"https://ddtank-web.onrender.com");
    const wsOrigin=websocketOrigin.protocol==="https:"?"wss://"+websocketOrigin.host:"ws://"+websocketOrigin.host;
    res.set("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' "+wsOrigin+"; media-src 'self' blob:; worker-src 'self' blob:; font-src 'self' data:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'");
    send(res,"Cliente Flash original",clientHtml(flashProxyOptions()),req.user);
  });
  app.get("/game-client/status",requireUser,(req,res)=>res.json({
    stage:"flash-assets-loader",
    allowedAssets:Object.keys(FILES).length,
    originalServerOnline:false,
    tcpBridgeConfigured:configuredBridge().enabled,
    localhostAuthRewriteActive:true,
    knownLegacyApiEndpoints:3,
    legacyAuthEndpointConnected:false,
    translatedLocaleAvailable:fs.existsSync(PTBR_LOCALE),
    translatedLocaleActive:ptBrLocaleActive(),
    manualPtBrCorrections:Object.keys(PTBR_MANUAL).length,
    authenticatedFlashSession:false,
    combatProtocolPorted:false,
    note:"O endereço antigo localhost/rest-auth/login é interceptado e retorna diagnóstico 503. Ele não autentica, valida senhas ou conecta o servidor C#."
  }));
  app.get("/game-client/files/*",requireUser,async(req,res)=>{
    // Exact manifest match prevents path traversal and arbitrary GitHub downloads.
    const filename=req.params[0];
    if(!allowedPath(filename))return res.status(404).send("Arquivo não autorizado");
    try{
      let buffer=await getAsset(filename);
      const type=contentType(filename);
      if(filename==="ui/vietnam/language.txt" && ptBrLocaleActive() && req.query.original!=="1"){
        const contents=fs.readFileSync(PTBR_LOCALE);
        if(contents.length>0 && contents.length<1000000){buffer=applyPtBrOverrides(contents);res.set("X-DDTank-Translation","pt-BR-experimental");}
      }else if(filename==="config.xml"){
        const origin=process.env.PUBLIC_ORIGIN||"https://ddtank-web.onrender.com";
        buffer=Buffer.from(safeConfig(buffer.toString("utf8"),origin),"utf8");
      }else if(filename==="crossdomain.xml"){
        buffer=Buffer.from('<?xml version="1.0" encoding="utf-8"?><cross-domain-policy></cross-domain-policy>',"utf8");
      }
      res.set("Cache-Control","private, max-age=300");
      res.set("X-Content-Type-Options","nosniff");
      res.set("Content-Type",type);
      return res.send(buffer);
    }catch(error){
      return res.status(error.status||502).send("Recurso indisponível para teste");
    }
  });
}
module.exports={mountOriginalClient,allowedPath,gitBlobSha,safeConfig,contentType,clientHtml,ptBrLocaleActive,PTBR_LOCALE,applyPtBrOverrides};
