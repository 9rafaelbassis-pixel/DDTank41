"use strict";
// Read-only header decoder adapted from Game.Base/Packets/GSPacketIn.cs and
// StreamProcessor.cs. No decryption, mutation, logging or packet capture.
const HEADER_LENGTH=20;
const MAGIC=29099; // 0x71ab
const MAX_FRAME=8192;
function parseHeader(frame) {
 if(!Buffer.isBuffer(frame)||frame.length<HEADER_LENGTH)return null;
 if(frame.readUInt16BE(0)!==MAGIC)return null;
 const declaredLength=frame.readUInt16BE(2);
 if(declaredLength<HEADER_LENGTH||declaredLength>MAX_FRAME)return null;
 return {
  declaredLength,checksum:frame.readUInt16BE(4),packetCode:frame.readInt16BE(6),
  clientId:frame.readInt32BE(8),parameter1:frame.readInt32BE(12),
  parameter2:frame.readInt32BE(16),frameComplete:frame.length>=declaredLength
 };
}
function expectedChecksum(frame){
 const header=parseHeader(frame);
 if(!header||!header.frameComplete)return null;
 let checksum=119;
 for(let i=6;i<header.declaredLength;i++)checksum+=frame[i];
 return checksum&0x7F7F;
}
module.exports={MAGIC,HEADER_LENGTH,MAX_FRAME,parseHeader,expectedChecksum};
