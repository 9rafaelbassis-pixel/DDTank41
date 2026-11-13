const test=require("node:test");
const assert=require("node:assert/strict");
const {startBattle,shoot}=require("../battle");
function players(){return [{id:1,name:"P1"},{id:2,name:"P2"}]}
test("two users start with authoritative turns and health",()=>{
 const b=startBattle(players());
 assert.equal(b.players.length,2);assert.equal(b.turn,1);
 assert.equal(b.players[0].hp,100);
 assert.throws(()=>startBattle([{id:1},{id:1}]));
});
test("first shot advances turn without allowing extra shot",()=>{
 const b=startBattle(players());
 const out=shoot(b,1,45,80);
 assert.equal(out.by,1);assert.equal(b.turn,2);
 assert.throws(()=>shoot(b,1,45,80),/vez/);
});
test("rejects impossible angles and power",()=>{
 const b=startBattle(players());
 for(const [angle,power] of [[-1,80],[90,30],[45,101],[45,0],[2.5,50]]){
  assert.throws(()=>shoot(b,1,angle,power));
 }
});
test("state is only modified for accepted turn",()=>{
 const b=startBattle(players());const before=JSON.stringify(b);
 assert.throws(()=>shoot(b,2,45,70));
 assert.equal(JSON.stringify(b),before);
});
