"use strict";
// Minimal isolated, authoritative 1v1 physics test. Does not claim DDTank 4.1 compatibility.
const LIMIT=1000;
function startBattle(users){
 if(!Array.isArray(users)||users.length!==2||users[0].id===users[1].id)throw Error("2 different users required");
 return {mode:"prototype",state:"playing",turn:users[0].id,shot:0,
   players:users.map((u,i)=>({id:u.id,name:String(u.name||"Jogador #"+u.id),x:i===0?80:920,hp:100}))};
}
function shoot(battle,byId,angle,power) {
 if(!battle||battle.state!=="playing")throw Error("Partida encerrada");
 if(battle.turn!==byId)throw Error("Não é sua vez");
 if(!Number.isInteger(angle)||angle<0||angle>85||!Number.isInteger(power)||power<1||power>100)throw Error("Ângulo ou força inválidos");
 const attacker=battle.players.find(p=>p.id===byId);
 const defender=battle.players.find(p=>p.id!==byId);
 if(!attacker||!defender)throw Error("Jogador desconhecido");
 const speed=power*1.25;
 const radians=angle*Math.PI/180;
 const time=(2*speed*Math.sin(radians))/10;
 const reach= speed*Math.cos(radians)*time;
 const direction=attacker.x<defender.x?1:-1;
 const landing=Math.max(0,Math.min(LIMIT,attacker.x+direction*reach));
 const distance=Math.abs(landing-defender.x);
 const damage=distance<=65?Math.max(1,Math.round(38*(1-distance/75))):0;
 defender.hp=Math.max(0,defender.hp-damage);
 battle.shot++;
 if(defender.hp<=0)battle.state="finished";else battle.turn=defender.id;
 return {by:byId,angle,power,landing:Math.round(landing),distance:Math.round(distance),
  damage,hit:damage>0,shot:battle.shot,state:battle.state,
  winner:battle.state==="finished"?attacker.id:null,turn:battle.turn,
  players:battle.players.map(p=>({...p}))};
}
module.exports={startBattle,shoot};
