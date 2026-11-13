"use strict";
const crypto = require("node:crypto");
// Persistent portal character/inventory: isolated from the legacy SQL Server.
// Uses original ItemTemplateInfo IDs, NOT the old game's user IDs or database.
const isName = s => /^[\p{L}\p{N}_ -]{3,20}$/u.test(s);
const validInt = (s,min,max) => {
  if (!/^[0-9]+$/.test(String(s))) return null;
  const n=Number(s);
  return Number.isSafeInteger(n) && n>=min && n<=max?n:null;
};
const nonce = () => crypto.randomUUID();
async function initCharacters(pool) {
  await pool.query("CREATE TABLE IF NOT EXISTS portal_characters(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL UNIQUE REFERENCES portal_users(id) ON DELETE CASCADE,nickname TEXT NOT NULL,gender TEXT NOT NULL CHECK(gender IN ('M','F')),level INTEGER NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 100),experience BIGINT NOT NULL DEFAULT 0,gold BIGINT NOT NULL DEFAULT 0 CHECK(gold>=0),money BIGINT NOT NULL DEFAULT 0 CHECK(money>=0),legacy_user_id INTEGER UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS portal_characters_nickname_ci ON portal_characters (LOWER(nickname))");
  await pool.query("CREATE TABLE IF NOT EXISTS portal_inventory(id BIGSERIAL PRIMARY KEY,character_id BIGINT NOT NULL REFERENCES portal_characters(id) ON DELETE CASCADE,template_id INTEGER NOT NULL REFERENCES legacy_item_templates(template_id),quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 999),equip_slot TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS portal_inventory_one_slot ON portal_inventory(character_id,equip_slot) WHERE equip_slot IS NOT NULL");
  await pool.query("CREATE TABLE IF NOT EXISTS portal_gm_operations(id UUID PRIMARY KEY,admin_user_id BIGINT NOT NULL REFERENCES portal_users(id),character_id BIGINT NOT NULL REFERENCES portal_characters(id),operation TEXT NOT NULL,details JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
}
const charQuery="SELECT id,user_id,nickname,gender,level,experience,gold,money,legacy_user_id FROM portal_characters WHERE user_id=$1";
async function characterOf(pool,userId) {
  const r=await pool.query(charQuery,[userId]);return r.rows[0]||null;
}
const box = (title,inner) => '<section class="panel"><h1>'+title+'</h1>'+inner+'</section>';
function mountCharacters(app,{pool,requireUser,requireAdmin,send,esc,csrfField}) {
  app.get("/character",requireUser,async(req,res,next)=>{try{
    const char=await characterOf(pool,req.user.id);
    if(char)return send(res,"Personagem",box("Seu personagem",
      '<p><strong>Nome:</strong> '+esc(char.nickname)+'</p><p><strong>Nível:</strong> '+char.level+
      ' | <strong>Ouro:</strong> '+char.gold+' | <strong>Cupons:</strong> '+char.money+'</p>'+
      '<p class="muted">Este personagem está salvo no portal. Integração com o cliente e servidor original: pendente.</p>'+
      '<a class="btn" href="/inventory">Abrir inventário</a>'),req.user);
    send(res,"Criar personagem",box("Crie seu personagem",
      '<p>Uma conta pode criar um personagem neste portal. Os dados do DDTank antigo continuam separados.</p>'+
      '<form method="post" action="/character">'+csrfField(res)+
      '<label>Apelido (3 a 20 caracteres)<input name="nickname" maxlength="20" minlength="3" required></label>'+
      '<label>Personagem<select name="gender" style="background:#08142a;color:#fff;padding:12px;display:block;margin:12px 0"><option value="M">Masculino</option><option value="F">Feminino</option></select></label>'+
      '<button type="submit">Criar personagem</button></form>'),req.user);
  }catch(err){next(err)}});
  app.post("/character",requireUser,async(req,res,next)=>{try{
    const name=String(req.body.nickname||"").trim().normalize("NFC");
    const gender=String(req.body.gender||"");
    if(!isName(name)||!["M","F"].includes(gender))
      return send(res,"Dados inválidos",box("Personagem inválido",'<p>Use 3 a 20 letras, números, espaços, hífen ou underline.</p>'),req.user,400);
    await pool.query("INSERT INTO portal_characters(user_id,nickname,gender) VALUES($1,$2,$3)",[req.user.id,name,gender]);
    res.redirect("/character");
  }catch(err){
    if(err.code==="23505")return send(res,"Não disponível",box("Nome indisponível",'<p>Esse nome já está em uso ou sua conta já tem personagem.</p><a href="/character">Voltar</a>'),req.user,409);
    next(err);
  }});
  app.get("/inventory",requireUser,async(req,res,next)=>{try{
    const char=await characterOf(pool,req.user.id);
    if(!char)return res.redirect("/character");
    const r=await pool.query("SELECT i.id,i.quantity,i.equip_slot,t.template_id,t.name,t.name_ptbr,t.category_id,t.attack,t.defence,t.agility,t.luck FROM portal_inventory i JOIN legacy_item_templates t ON t.template_id=i.template_id WHERE i.character_id=$1 ORDER BY i.equip_slot NULLS LAST,i.id LIMIT 250",[char.id]);
    let html='<p>Personagem: <strong>'+esc(char.nickname)+'</strong>. Itens vinculados ao portal; ainda não aparecem no jogo Flash.</p><div class="tablewrap"><table><thead><tr><th>Item</th><th>Quantidade</th><th>Categoria</th><th>Equipado</th><th>Ação</th></tr></thead><tbody>';
    for(const item of r.rows){
      let action='—';
      if(item.category_id>=1&&item.category_id<=9){
        action='<form method="post" action="/inventory/equip">'+csrfField(res)+'<input type="hidden" name="inventoryId" value="'+item.id+'"><button type="submit">'+(item.equip_slot?'Desequipar':'Equipar')+'</button></form>';
      }
      html+='<tr><td>'+esc(item.name_ptbr||item.name)+' <small>(ID '+item.template_id+')</small></td><td>'+item.quantity+'</td><td>'+item.category_id+'</td><td>'+esc(item.equip_slot||'Não')+'</td><td>'+action+'</td></tr>';
    }
    if(!r.rowCount)html+='<tr><td colspan="5">Inventário vazio. Um administrador pode entregar itens pelo painel GM.</td></tr>';
    html+='</tbody></table></div><p class="muted">Equipar funciona apenas no banco do portal (categorias 1–9); isso não controla sprites nem atributos de batalha do DDTank original.</p>';
    send(res,"Inventário",box("Meu inventário",html),req.user);
  }catch(err){next(err)}});
  app.post("/inventory/equip",requireUser,async(req,res,next)=>{
    const inventoryId=validInt(req.body.inventoryId,1,Number.MAX_SAFE_INTEGER);
    if(inventoryId==null)return res.status(400).send("Item inválido");
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const char=await client.query("SELECT id FROM portal_characters WHERE user_id=$1 FOR UPDATE",[req.user.id]);
      if(!char.rowCount){await client.query("ROLLBACK");return res.redirect("/character")}
      const item=await client.query("SELECT i.id,i.equip_slot,t.category_id FROM portal_inventory i JOIN legacy_item_templates t ON t.template_id=i.template_id WHERE i.id=$1 AND i.character_id=$2",[inventoryId,char.rows[0].id]);
      if(!item.rowCount||item.rows[0].category_id<1||item.rows[0].category_id>9){await client.query("ROLLBACK");return res.status(400).send("Item não equipável")}
      const slot='categoria-'+item.rows[0].category_id;
      if(item.rows[0].equip_slot){
        await client.query("UPDATE portal_inventory SET equip_slot=NULL WHERE id=$1",[inventoryId]);
      }else{
        await client.query("UPDATE portal_inventory SET equip_slot=NULL WHERE character_id=$1 AND equip_slot=$2",[char.rows[0].id,slot]);
        await client.query("UPDATE portal_inventory SET equip_slot=$1 WHERE id=$2",[slot,inventoryId]);
      }
      await client.query("COMMIT");res.redirect("/inventory");
    }catch(err){await client.query("ROLLBACK");next(err)}finally{client.release()}
  });
  app.get("/admin/players",requireAdmin,async(req,res,next)=>{try{
    const players=await pool.query("SELECT c.id,c.nickname,c.level,c.gold,c.money,u.email FROM portal_characters c JOIN portal_users u ON u.id=c.user_id ORDER BY c.id DESC LIMIT 100");
    const itemId=validInt(req.query.itemId,1,2147483647);
    let selected=null;
    if(itemId!=null){const r=await pool.query("SELECT template_id,name,name_ptbr FROM legacy_item_templates WHERE template_id=$1",[itemId]);selected=r.rows[0]||null}
    let html='<p>Gerenciamento dos personagens do portal. Nenhuma alteração é enviada ao banco legado do DDTank.</p><div class="tablewrap"><table><thead><tr><th>ID</th><th>Apelido</th><th>Nível</th><th>Ouro</th><th>Cupons</th></tr></thead><tbody>';
    for(const p of players.rows)html+='<tr><td>'+p.id+'</td><td>'+esc(p.nickname)+'</td><td>'+p.level+'</td><td>'+p.gold+'</td><td>'+p.money+'</td></tr>';
    html+='</tbody></table></div><p class="muted">Até 100 personagens mais recentes. Utilize o ID numérico da tabela.</p>';
    send(res,"Painel GM",box("Painel GM — personagens",html)+
      box("Entregar item do catálogo",'<p>Informe um TemplateID válido do catálogo original. A entrega fica registrada no banco do portal.</p><form method="post" action="/admin/gm/grant">'+csrfField(res)+
        '<input type="hidden" name="requestId" value="'+nonce()+'">'+
        '<label>ID do personagem<input name="characterId" type="number" min="1" required></label>'+
        '<label>ID do item<input name="templateId" type="number" min="1" required '+(selected?'value="'+selected.template_id+'"':'')+'></label>'+
        (selected?'<p>Item selecionado: '+esc(selected.name_ptbr||selected.name)+'</p>':'')+
        '<label>Quantidade (1 a 99)<input name="quantity" type="number" min="1" max="99" value="1" required></label>'+
        '<button type="submit">Entregar no portal</button></form>')+
      box("Creditar moedas",'<form method="post" action="/admin/gm/currency">'+csrfField(res)+
        '<input type="hidden" name="requestId" value="'+nonce()+'">'+
        '<label>ID do personagem<input name="characterId" type="number" min="1" required></label>'+
        '<label>Moeda<select name="kind" style="background:#08142a;color:white;padding:12px;margin:12px 0"><option value="gold">Ouro</option><option value="money">Cupons</option></select></label>'+
        '<label>Valor (1 a 100.000)<input name="amount" type="number" min="1" max="100000" required></label><button type="submit">Creditar no portal</button></form>'),req.user);
  }catch(err){next(err)}});
  async function gm(req,res,next,operation) {
    const id=validInt(req.body.characterId,1,Number.MAX_SAFE_INTEGER);
    const requestId=String(req.body.requestId||"");
    if(id===null||!uuid(requestId))return res.status(400).send("Identificador inválido");
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const char=await client.query("SELECT id FROM portal_characters WHERE id=$1 FOR UPDATE",[id]);
      if(!char.rowCount){await client.query("ROLLBACK");return res.status(404).send("Personagem inexistente")}
      let details;
      if(operation==="item"){
        const templateId=validInt(req.body.templateId,1,2147483647),qty=validInt(req.body.quantity,1,99);
        if(templateId===null||qty===null){await client.query("ROLLBACK");return res.status(400).send("Item ou quantidade inválidos")}
        const item=await client.query("SELECT template_id FROM legacy_item_templates WHERE template_id=$1",[templateId]);
        if(!item.rowCount){await client.query("ROLLBACK");return res.status(404).send("Template inexistente")}
        details={templateId,quantity:qty};
      }else{
        const kind=String(req.body.kind||""),amount=validInt(req.body.amount,1,100000);
        if(!["gold","money"].includes(kind)||amount===null){await client.query("ROLLBACK");return res.status(400).send("Moeda ou quantia inválida")}
        details={kind,amount};
      }
      const mark=await client.query("INSERT INTO portal_gm_operations(id,admin_user_id,character_id,operation,details) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id",[requestId,req.user.id,id,operation,JSON.stringify(details)]);
      if(!mark.rowCount){await client.query("ROLLBACK");return res.status(409).send("Operação já processada. Não foi executada duas vezes.")}
      if(operation==="item"){
        await client.query("INSERT INTO portal_inventory(character_id,template_id,quantity) VALUES($1,$2,$3)",[id,details.templateId,details.quantity]);
      }else{
        const col=details.kind==="gold"?"gold":"money";
        await client.query("UPDATE portal_characters SET "+col+"="+col+"+$1 WHERE id=$2",[details.amount,id]);
      }
      await client.query("INSERT INTO admin_audit(actor_id,action,details) VALUES ($1,$2,$3::jsonb)",[req.user.id,"gm."+operation,JSON.stringify({characterId:id,operationId:requestId,...details})]);
      await client.query("COMMIT");return res.redirect("/admin/players");
    }catch(err){await client.query("ROLLBACK");next(err)}finally{client.release()}
  }
  app.post("/admin/gm/grant",requireAdmin,(req,res,next)=>gm(req,res,next,"item"));
  app.post("/admin/gm/currency",requireAdmin,(req,res,next)=>gm(req,res,next,"currency"));
}
function uuid(s) {return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)}
module.exports={initCharacters,mountCharacters,characterOf,isName,validInt};
