"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {Pool}=require("pg");
const {initGameTickets,issueTicket,redeemTicket}=require("../game-tickets");
async function main(){
 const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false});
 try{
  await pool.query("CREATE TABLE portal_users(id BIGSERIAL PRIMARY KEY,email TEXT NOT NULL UNIQUE)");
  await pool.query("CREATE TABLE portal_characters(id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL UNIQUE REFERENCES portal_users(id),nickname TEXT NOT NULL,legacy_user_id INTEGER)");
  await initGameTickets(pool);
  const user=await pool.query("INSERT INTO portal_users(email) VALUES('jogador@teste.invalid') RETURNING id");
  const userId=user.rows[0].id;
  const character=await pool.query("INSERT INTO portal_characters(user_id,nickname) VALUES($1,'Herói de Teste') RETURNING id",[userId]);
  const characterId=character.rows[0].id;
  const issued=await issueTicket(pool,userId);
  assert.match(issued.ticket,/^[a-f0-9]{64}$/);
  let row=await pool.query("SELECT user_id,character_id,expires_at>NOW() AS valid FROM portal_game_tickets");
  assert.equal(row.rowCount,1);
  assert.equal(row.rows[0].user_id,userId);
  assert.equal(row.rows[0].character_id,characterId);
  assert.equal(row.rows[0].valid,true);
  const claimed=await redeemTicket(pool,issued.ticket);
  assert.equal(claimed.characterId,characterId);
  assert.equal(claimed.nickname,"Herói de Teste");
  assert.equal(claimed.legacyUserId,null);
  assert.equal(await redeemTicket(pool,issued.ticket),null,"Ticket não pode ser reutilizado");
  const second=await issueTicket(pool,userId);
  const digest=crypto.createHash("sha256").update(second.ticket).digest("hex");
  await pool.query("UPDATE portal_game_tickets SET expires_at=NOW()-INTERVAL '1 second' WHERE token_hash=$1",[digest]);
  assert.equal(await redeemTicket(pool,second.ticket),null,"Ticket expirado não pode ser aceito");
  assert.equal(await issueTicket(pool,999999),null,"Conta inexistente não emite ticket");
  console.log("SUCESSO: ticket 256 bits, 2 minutos, usuário/character vinculados, consumo único e expiração em PostgreSQL real");
 } finally {await pool.end()}
}
main().catch(err=>{console.error("Integração PostgreSQL falhou:",err.message);process.exitCode=1});
