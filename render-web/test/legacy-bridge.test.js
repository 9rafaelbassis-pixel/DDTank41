const test=require("node:test");
const assert=require("node:assert/strict");
const {configuredBridge,flashProxyOptions}=require("../legacy-bridge");
const good={DDTANK_TCP_BRIDGE_ENABLED:"true",DDTANK_FLASH_SOCKET_HOST:"127.0.0.1",
 DDTANK_FLASH_SOCKET_PORT:"9500",DDTANK_TCP_HOST:"ddtank-game.internal",DDTANK_TCP_PORT:"9500",
 PUBLIC_ORIGIN:"https://ddtank-web.onrender.com"};
test("relay is disabled without explicit opt-in",()=>{
 assert.equal(configuredBridge({}).enabled,false);
 assert.deepEqual(flashProxyOptions({}),[]);
});
test("allows only configured fixed backend host and port",()=>{
 const info=configuredBridge(good);
 assert.equal(info.enabled,true);
 assert.equal(info.tcpHost,"ddtank-game.internal");
 assert.deepEqual(flashProxyOptions(good),[{host:"127.0.0.1",port:9500,proxyUrl:"wss://ddtank-web.onrender.com/game-client/socket"}]);
});
test("rejects arbitrary URL and invalid ports",()=>{
 assert.equal(configuredBridge({...good,DDTANK_TCP_HOST:"http://example.com"}).enabled,false);
 assert.equal(configuredBridge({...good,DDTANK_TCP_PORT:"0"}).enabled,false);
 assert.equal(configuredBridge({...good,DDTANK_FLASH_SOCKET_PORT:"99999"}).enabled,false);
 assert.equal(configuredBridge({...good,DDTANK_TCP_HOST:"a..b"}).enabled,false);
 assert.deepEqual(flashProxyOptions({...good,PUBLIC_ORIGIN:"http://example.com"}),[]);
});
