"use strict";
const {configuredBridge}=require("./legacy-bridge");
const {ptBrLocaleActive}=require("./original-client");
const {settings}=require("./game-tickets");
function snapshot(env=process.env){
 const socket=configuredBridge(env);
 return [
 {name:"Portal Node/PostgreSQL",state:"operacional_no_codigo",detail:"Login, personagens e catálogo do portal"},
 {name:"Idioma Flash PT-BR",state:ptBrLocaleActive()?"arquivo_instalado":"desativado",detail:"Tradução experimental; textos embutidos no SWF podem continuar em outro idioma"},
 {name:"Compilação dos serviços C# originais",state:"a_validar",detail:"Dependências net472/net48 e SQL Server — consultar workflow Windows"},
 {name:"Servidor de jogo C# original",state:"não_integrado",detail:"Não há Game.Server original confirmado em execução"},
 {name:"Autenticação de jogo",state:settings(env).enabled?"troca_de_tickets_configurada":"desativada",detail:"Mesmo configurada, a troca de tickets NÃO substitui a autenticação original"},
 {name:"Ponte WebSocket/TCP",state:socket.enabled?"configurada_sem_prova_de_conexão":"desativada",detail:"Exige servidor C# confiável com endereço TCP privado"},
 {name:"Combate e resultado originais",state:"não_integrado",detail:"O laboratório /lobby ainda é um protótipo separado"},
 {name:"Itens GM no servidor original",state:"não_integrado",detail:"GM atual atua somente nos personagens do portal"}
 ];
}
function mountReadiness(app,{pool,requireAdmin,send,esc}) {
 app.get("/admin/integration",requireAdmin,async(req,res,next)=>{
  try{
   res.set("Cache-Control","private, no-store");
   const tickets=await pool.query("SELECT COUNT(*)::int AS n FROM portal_game_tickets WHERE expires_at>NOW()");
   const audits=await pool.query("SELECT a.action,a.details,a.created_at FROM admin_audit a ORDER BY a.id DESC LIMIT 12");
   const rows=snapshot().map(s=>'<tr><td>'+esc(s.name)+'</td><td>'+esc(s.state)+'</td><td>'+esc(s.detail)+'</td></tr>').join("");
   const log=audits.rows.map(a=>'<tr><td>'+esc(a.action)+'</td><td>'+esc(new Date(a.created_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}))+'</td></tr>').join("");
   const html='<section class="panel"><h1>Integração do DDTank verdadeiro</h1>'+
    '<p>Diagnóstico do código e da configuração, não uma confirmação de disponibilidade do servidor C#. Sem acessar senhas, endereços privados ou executar comandos no servidor.</p>'+
    '<p><strong>Tickets de jogo ativos:</strong> '+tickets.rows[0].n+' (nunca exibimos o valor deles).</p>'+
    '<div class="tablewrap"><table><thead><tr><th>Área</th><th>Situação</th><th>Detalhe</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<p><a class="btn" href="/admin/players">Painel GM</a> <a class="btn" href="/game-client">Cliente original</a></p>'+
    '<p class="warn">Não habilite a ponte TCP nem configure a chave de jogo até confirmar o Game.Server original em um ambiente confiável.</p></section>'+
    '<section class="panel"><h2>Últimas ações administrativas</h2><div class="tablewrap"><table><thead><tr><th>Operação</th><th>Data</th></tr></thead><tbody>'+log+'</tbody></table></div></section>';
   send(res,"Diagnóstico do jogo",html,req.user);
  }catch(err){next(err)}
 });
}
module.exports={snapshot,mountReadiness};
