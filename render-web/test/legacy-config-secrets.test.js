const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..","..");
const configs=["Tank.Request/Web.config","Road.Service/App.config","Center.Service/App.config","Fighting.Service/App.config"];
test("original tracked IIS/service configs no longer contain active plaintext connection strings",()=>{
 for(const file of configs){
  const text=fs.readFileSync(path.join(root,file),"utf8");
  for(const key of ["conString","crosszoneString"]){
   assert.match(text,new RegExp('<add\\s+key="'+key+'"\\s+value=""\\s*\\/>','i'),file+": "+key);
  }
 }
});
test("old web and service authentication private keys are disabled in tracked config",()=>{
 const text=fs.readFileSync(path.join(root,"Tank.Request/Web.config"),"utf8");
 for(const key of ["privateKey","LoginKey","ChargeKey","SentRewardKey"]){
  assert.match(text,new RegExp('<add\\s+key="'+key+'"\\s+value=""\\s*\\/>','i'),key);
 }
});
