const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {allowedPath,ptBrLocaleActive,PTBR_LOCALE,applyPtBrOverrides}=require("../original-client");
test("PT-BR locale never changes original asset manifest",()=>{
 assert.equal(allowedPath("ui/vietnam/language.txt"),true);
 assert.ok(PTBR_LOCALE.endsWith("flash-ui-language.ptbr.txt"));
});
test("PT-BR locale switches on only if reviewed generated file exists",()=>{
 const old=process.env.DDTANK_FLASH_PTBR;
 try {
  process.env.DDTANK_FLASH_PTBR="false";
  assert.equal(ptBrLocaleActive(),false);
  delete process.env.DDTANK_FLASH_PTBR;
  assert.equal(ptBrLocaleActive(),fs.existsSync(PTBR_LOCALE));
 } finally {
  if(old===undefined)delete process.env.DDTANK_FLASH_PTBR;
  else process.env.DDTANK_FLASH_PTBR=old;
 }
});

test("generated PT-BR locale corrections replace all known placeholder texts",()=>{
 const before=fs.readFileSync(PTBR_LOCALE,"utf8");
 const after=applyPtBrOverrides(before).toString("utf8");
 assert.equal(after.includes("[Texto pendente de revisão]"),false);
 assert.ok(after.includes("chat.FastReplyDefaultStr:<Padrão>"));
 assert.ok(after.includes("tank.game.BuffTip279:Ao atacar, converte {0}% do dano causado em pontos de vida."));
 assert.ok(after.includes("ddt.loader.AvatarCollectionUnitDataFail:Falha ao carregar as informações da imagem."));
 assert.equal(after.split("\n").length,before.split("\n").length);
});
