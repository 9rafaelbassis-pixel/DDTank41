const test=require("node:test");
const assert=require("node:assert/strict");
const {isName,validInt}=require("../characters");
test("accepts valid Brazilian character nickname",()=>{
 assert.equal(isName("GuerreiroBR"),true);
 assert.equal(isName("João da Silva"),true);
 assert.equal(isName("A"),false);
 assert.equal(isName("<script>"),false);
 assert.equal(isName("X".repeat(21)),false);
});
test("numeric ids and quantities validated",()=>{
 assert.equal(validInt("3",1,99),3);
 for(const v of ["-2","1e4","0","2.5","999","NaN",""]){
  assert.equal(validInt(v,1,99),null);
 }
});
