const test=require("node:test");
const assert=require("node:assert/strict");
const {normalize}=require("../catalog");
test("reads original ItemTemplateInfo fields",()=>{
 assert.deepEqual(normalize({TemplateID:1110,Name:"Item original",CategoryID:7,Attack:10,Defence:20,Agility:30,Luck:40,Quality:4}),
 [1110,"Item original",7,"",10,20,30,40,4,null,"original_nao_traduzido"]);
});
test("refuses duplicated/inappropriate fields",()=>{
 for(const x of [{TemplateID:0,Name:"Item"},{TemplateID:4,Name:""},{TemplateID:"NaN",Name:"Item"},{TemplateID:5,Name:"item",Attack:999999999999}]){
  assert.throws(()=>normalize(x));
 }
});

test("preserves original name and adds reviewed translation separately",()=>{
 const model=normalize({TemplateID:7001,Name:"Búa phá đá",NamePTBR:"Martelo Quebra-Pedras",StatusTraducao:"manual_sugestao",CategoryID:7});
 assert.equal(model[0],7001);
 assert.equal(model[1],"Búa phá đá");
 assert.equal(model[9],"Martelo Quebra-Pedras");
 assert.equal(model[10],"manual_sugestao");
});
test("refuses unrecognized translation status",()=>{
 assert.throws(()=>normalize({TemplateID:42,Name:"Original",NamePTBR:"Teste",StatusTraducao:"nao autorizado"}));
});
