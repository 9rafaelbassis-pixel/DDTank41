"use strict";
// Real ItemTemplateInfo catalog in portal, uploaded from original SQL Server.
// No write path to game character inventories exists yet.
function i32(v) {
  const n=Number(v??0);
  if(!Number.isInteger(n)||n< -2147483648||n>2147483647)throw Error("integer");
  return n;
}
function normalize(raw) {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("object");
  const id=i32(raw.TemplateID),name=String(raw.Name??"").trim(),pic=String(raw.Pic??"").trim();
  if(id===0||name.length<1||name.length>150||pic.length>256)throw Error("fields");
  const ptName = raw.NamePTBR == null ? null : String(raw.NamePTBR).trim();
  const status = String(raw.StatusTraducao ?? "original_nao_traduzido");
  if(ptName !== null && (ptName.length < 1 || ptName.length > 150))throw Error("translated name");
  if(!["manual_sugestao","automatica_parcial","original_nao_traduzido","revisado_comunidade"].includes(status))throw Error("translation status");
  return [id,name,i32(raw.CategoryID),pic,i32(raw.Attack),i32(raw.Defence),i32(raw.Agility),i32(raw.Luck),i32(raw.Quality),ptName,status];
}
async function initCatalog(pool) {
  await pool.query("CREATE TABLE IF NOT EXISTS legacy_item_templates(template_id INTEGER PRIMARY KEY,name TEXT NOT NULL,category_id INTEGER NOT NULL DEFAULT 0,pic TEXT NOT NULL DEFAULT '',attack INTEGER NOT NULL DEFAULT 0,defence INTEGER NOT NULL DEFAULT 0,agility INTEGER NOT NULL DEFAULT 0,luck INTEGER NOT NULL DEFAULT 0,quality INTEGER NOT NULL DEFAULT 0,imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("ALTER TABLE legacy_item_templates ADD COLUMN IF NOT EXISTS name_ptbr TEXT");
  await pool.query("ALTER TABLE legacy_item_templates ADD COLUMN IF NOT EXISTS translation_status TEXT NOT NULL DEFAULT 'original_nao_traduzido'");
  await pool.query("CREATE TABLE IF NOT EXISTS admin_audit(id BIGSERIAL PRIMARY KEY,actor_id BIGINT NOT NULL REFERENCES portal_users(id),action TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
}
function mountCatalog(app,{pool,requireAdmin,send,esc,csrfField}) {
  app.get("/admin/catalog",requireAdmin,async(req,res,next)=>{try{
    const q=String(req.query.q??"").trim().slice(0,80);
    const rows=await pool.query("SELECT template_id,name,name_ptbr,translation_status,category_id,attack,defence,agility,luck FROM legacy_item_templates WHERE name ILIKE $1 OR COALESCE(name_ptbr,'') ILIKE $1 OR CAST(template_id AS TEXT)=$2 ORDER BY template_id LIMIT 100",["%"+q+"%",q]);
    const count=await pool.query("SELECT COUNT(*)::int AS n FROM legacy_item_templates");
    let html='<section class="panel"><h1>Catálogo do jogo (somente leitura)</h1><p>'+count.rows[0].n+' modelos importados a partir do SQL Server original. Não são itens inventados.</p>';
    html+='<form method="get"><label>Pesquisar<input name="q" maxlength="80" value="'+esc(q)+'"></label><button>Buscar</button></form>';
    html+='<div class="tablewrap"><table><thead><tr><th>ID</th><th>Nome PT-BR</th><th>Nome original</th><th>Tradução</th><th>Categoria</th><th>Ataque</th><th>Defesa</th><th>Agilidade</th><th>Sorte</th></tr></thead><tbody>';
    for(const x of rows.rows)html+='<tr><td>'+x.template_id+'</td><td>'+esc(x.name_ptbr || x.name)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.translation_status === "manual_sugestao"?"Sugestão específica":x.translation_status === "automatica_parcial"?"Automática (revisar)":x.translation_status === "revisado_comunidade"?"Revisada":"Original")+'</td><td>'+x.category_id+'</td><td>'+x.attack+'</td><td>'+x.defence+'</td><td>'+x.agility+'</td><td>'+x.luck+'</td></tr>';
    if(!rows.rowCount)html+='<tr><td colspan="9">Nenhum item importado/encontrado.</td></tr>';
    html+='</tbody></table></div><p class="muted">Traduções parciais são sugestões e não nomes oficiais. O nome original e o ID ficam preservados.</p><p class="warn">Envio de itens ao jogo ainda não integrado.</p></section>';
    html+='<section class="panel"><h2>Importar lote do SQL Server</h2><p>Use tools/migration/Export-DDTankCatalog.ps1 no banco restaurado. Cole um arquivo catalog-XXXX.json por vez; até 75 itens.</p>';
    html+='<form method="post" action="/admin/catalog/import">'+csrfField(res)+'<label>JSON<textarea name="templates" maxlength="95000" required rows="6" style="display:block;width:100%;background:#08142a;color:#fff;padding:12px;margin:12px 0"></textarea></label><button>Importar modelos</button></form></section>';
    html+='<section class="panel"><h2>Importação completa em um arquivo JSON</h2><p>Selecione o JSON original ou uma versão contendo NamePTBR e StatusTraducao. O servidor mantém os IDs, atributos e nomes originais; as sugestões em PT-BR aparecem em uma coluna separada. Os lotes são enviados de 75 em 75.</p><label>Arquivo JSON<input id="fullCatalog" type="file" accept=".json,application/json"></label><button type="button" id="bulkImport">Importar todos os itens</button><p id="bulkProgress" class="muted" aria-live="polite">Nenhum arquivo selecionado.</p></section>';
    html+='<script>(function(){var btn=document.getElementById("bulkImport");btn.onclick=async function(){var info=document.getElementById("bulkProgress");var file=document.getElementById("fullCatalog").files[0];if(!file){info.textContent="Selecione o arquivo JSON.";return;}if(file.size>5000000){info.textContent="Arquivo acima do limite de 5 MB.";return;}btn.disabled=true;try{var items=JSON.parse(await file.text());if(!Array.isArray(items)||!items.length||items.length>20000)throw Error("JSON precisa conter de 1 a 20 mil itens.");var token=document.querySelector("form[action=\\"/admin/catalog/import\\"] input[name=\\"_csrf\\"]").value;var done=0;for(var i=0;i<items.length;i+=75){var body=new URLSearchParams();body.set("_csrf",token);body.set("templates",JSON.stringify(items.slice(i,i+75)));var response=await fetch("/admin/catalog/import",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:body.toString()});if(!response.ok)throw Error("Falha no lote "+(1+Math.floor(i/75))+" (HTTP "+response.status+").");done+=Math.min(75,items.length-i);info.textContent="Importados "+done+" de "+items.length+" modelos...";}info.textContent="Importação concluída. Abrindo catálogo...";location.href="/admin/catalog";}catch(error){info.textContent="Importação interrompida: "+error.message+" Os lotes concluídos permanecem salvos; repetir é seguro.";}finally{btn.disabled=false}}})();</script>';
    send(res,"Catálogo",html,req.user);
  }catch(err){next(err)}});
  app.post("/admin/catalog/import",requireAdmin,async(req,res,next)=>{try{
    const raw=String(req.body.templates??"");
    let data;
    if(raw.length>95000)return res.status(413).send("Lote muito grande");
    try{data=JSON.parse(raw)}catch{return res.status(400).send("JSON inválido. Volte e confira o arquivo.")}
    if(!Array.isArray(data)||data.length<1||data.length>75)return res.status(400).send("Lote precisa ter de 1 a 75 itens.");
    let items;
    try{items=data.map(normalize);if(new Set(items.map(x=>x[0])).size!==items.length)throw Error("duplicate")}catch{return res.status(400).send("ID ou campos inválidos ou repetidos.")}
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      for(const values of items)await client.query("INSERT INTO legacy_item_templates(template_id,name,category_id,pic,attack,defence,agility,luck,quality,name_ptbr,translation_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(template_id) DO UPDATE SET name=EXCLUDED.name,category_id=EXCLUDED.category_id,pic=EXCLUDED.pic,attack=EXCLUDED.attack,defence=EXCLUDED.defence,agility=EXCLUDED.agility,luck=EXCLUDED.luck,quality=EXCLUDED.quality,name_ptbr=COALESCE(EXCLUDED.name_ptbr,legacy_item_templates.name_ptbr),translation_status=CASE WHEN EXCLUDED.name_ptbr IS NOT NULL THEN EXCLUDED.translation_status ELSE legacy_item_templates.translation_status END,imported_at=NOW()",values);
      await client.query("INSERT INTO admin_audit(actor_id,action,details) VALUES($1,'catalog.import',$2::jsonb)",[req.user.id,JSON.stringify({count:items.length})]);
      await client.query("COMMIT");
    }catch(err){await client.query("ROLLBACK");throw err}finally{client.release()}
    res.redirect("/admin/catalog");
  }catch(err){next(err)}});
}
module.exports={normalize,initCatalog,mountCatalog};
