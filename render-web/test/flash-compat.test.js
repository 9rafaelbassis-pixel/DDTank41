const test=require("node:test");
const assert=require("node:assert/strict");
const {LEGACY_LOGIN_ENDPOINTS,RELAY_PATH,authUrlRewriteRules,rejectLegacyLogin}=require("../flash-compat");
test("legacy URL rewrite includes only exact historic login endpoints",()=>{
 const rules=authUrlRewriteRules("https://ddtank-web.onrender.com");
 assert.equal(rules.length,2);
 assert.equal(rules[0][0],"https://127.0.0.1:8000/rest-auth/login/");
 for(let i=0;i<2;i++)assert.equal(rules[i][1],"https://ddtank-web.onrender.com"+RELAY_PATH);
 assert.equal(rules.some(([s])=>s.includes("evil.com")),false);
});
test("compat login responds unavailable without looking at password or database",()=>{
 const fakeReq={method:"POST",body:{password:"SECRET_CANNOT_BE_USED",username:"person"}};
 const headers={};let status=0,output;
 const fakeRes={
  set:(k,v)=>{headers[k]=v;return fakeRes},
  status:(code)=>{status=code;return fakeRes},
  json:(v)=>{output=v;return fakeRes}
 };
 rejectLegacyLogin(fakeReq,fakeRes);
 assert.equal(status,503);
 assert.equal(headers["Cache-Control"],"no-store");
 assert.equal(output.code,"GAME_AUTH_BACKEND_UNAVAILABLE");
 assert.equal(JSON.stringify(output).includes("SECRET_CANNOT_BE_USED"),false);
});
