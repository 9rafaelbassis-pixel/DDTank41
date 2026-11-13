const test=require("node:test");
const assert=require("node:assert/strict");
const {normalize}=require("../catalog");
test("reads original ItemTemplateInfo fields",()=>{
 assert.deepEqual(normalize({TemplateID:1110,Name:"Item original",CategoryID:7,Attack:10,Defence:20,Agility:30,Luck:40,Quality:4}),
 [1110,"Item original",7,"",10,20,30,40,4]);
});
test("refuses duplicated/inappropriate fields",()=>{
 for(const x of [{TemplateID:0,Name:"Item"},{TemplateID:4,Name:""},{TemplateID:"NaN",Name:"Item"},{TemplateID:5,Name:"item",Attack:999999999999}]){
  assert.throws(()=>normalize(x));
 }
});
