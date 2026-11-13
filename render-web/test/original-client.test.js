const test=require("node:test");
const assert=require("node:assert/strict");
const {allowedPath,gitBlobSha,safeConfig,contentType}=require("../original-client");

test("manifest admits only real original files",()=>{
 assert.equal(allowedPath("Launcher.swf"),true);
 assert.equal(allowedPath("ui/vietnam/language.txt"),true);
 assert.equal(allowedPath("ui/vietnam/swf/_corei.swf"),true);
 for(const entry of ["../../.env","Database/Game34.bak","http://bad.example/Launcher.swf","../Launcher.swf","/Launcher.swf","config.xml/../../.gitignore","config.xml%2f"])assert.equal(allowedPath(entry),false);
});
test("git blob SHA is checked against expected Git object format",()=>{
 const data=Buffer.from("hello world\n");
 assert.equal(gitBlobSha(data),"3b18e512dba79e4c8300dd08aeb37f8e728b8dad");
});
test("rewrites historic URLs and preserves safe resource language paths",()=>{
 const sample='<root><config><FLASHSITE value="http://127.0.0.1/flash/"/><BACKUP_FLASHSITE value="http://other/"/>'+
 '<SITE value="http://old/"/><WEEKLYSITE value="http://old/"/><FIRSTPAGE value="http://old/"/><REGISTER value="http://old/"/>'+
 '<LOGIN_PATH value="http://old/" /><REQUEST_PATH value="http://old/"/><FILL_PATH value="http://old/"/>'+
 '<USE_MD5 value="true"/><LANGUAGE value="vietnam"/><OFFICIAL_SITE value="http://evil/"/>'+
 '<POLICY_FILES><file value="http://old/crossdomain.xml"/></POLICY_FILES></config></root>';
 const result=safeConfig(sample,"https://ddtank-web.onrender.com");
 assert.match(result,/FLASHSITE value="https:\/\/ddtank-web\.onrender\.com\/game-client\/files\/"/);
 assert.match(result,/REQUEST_PATH value="https:\/\/ddtank-web\.onrender\.com\/game-client\/request-unavailable\/"/);
 assert.match(result,/LANGUAGE value="vietnam"/);
 assert.match(result,/USE_MD5 value="false"/);
 assert.doesNotMatch(result,/http:\/\/127\.0\.0\.1|http:\/\/evil/);
 assert.doesNotMatch(result,/POLICY_FILES>.*<file/);
});
test("safe configuration rejects non HTTPS origin in production",()=>{
 const old=process.env.NODE_ENV;
 process.env.NODE_ENV="production";
 try{
  assert.throws(()=>safeConfig("<root/>","http://evil.local"));
 }finally{process.env.NODE_ENV=old}
});
test("serves correct content types",()=>{
 assert.match(contentType("Launcher.swf"),/flash/);
 assert.match(contentType("ui/vietnam/language.txt"),/text\/plain/);
 assert.match(contentType("config.xml"),/xml/);
});
