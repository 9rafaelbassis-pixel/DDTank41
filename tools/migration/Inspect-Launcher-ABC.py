#!/usr/bin/env python3
"""Offline inspection of public Flash ABC constant pool.
Reports only sanitized URL paths and short constant names; no credentials or payloads.
This is diagnostic, not a replacement for a game server.
"""
import json
import re
import struct
import zlib
from pathlib import Path
from urllib.parse import urlsplit
ASSETS = [Path("Source Flash/FlashSV1")/n for n in ("Launcher.swf","Loading.swf","DDT_Loading.swf")]
OUTPUT=Path("migration-output/flash-client-audit")
TARGET=re.compile(r"(?:127\.0\.0\.1|/rest-auth/|login|password|register|loading|server|client|session)",re.I)
SHORTSAFE=re.compile(r"^[\w./:%?#=&{}:@+ -]{2,80}$",re.U)
URL=re.compile(r"https?://[^\s\x00<>\"']{3,240}",re.I)

def u30(raw,at):
 val=0
 for i in range(5):
  b=raw[at];at+=1
  val|=(b&127)<<(7*i)
  if b&128==0:return val,at
 return val,at
def abc_strings(abc):
 at=4
 try:
  for _ in range(2):
   count,at=u30(abc,at)
   if count>400000:return []
   for i in range(1,count):_,at=u30(abc,at)
  count,at=u30(abc,at)
  if count>400000:return []
  at+=max(0,count-1)*8
  count,at=u30(abc,at)
  if count>600000:return []
  result=[]
  for i in range(1,count):
   n,at=u30(abc,at)
   if n>100000 or at+n>len(abc):return result
   result.append(abc[at:at+n].decode("utf8","replace"))
   at+=n
  return result
 except (IndexError,ValueError):return []
def swf_tags(data):
 sig=data[:3]
 if sig==b"CWS":
  try:data=data[:8]+zlib.decompress(data[8:])
  except zlib.error:return sig,[],0
 elif sig!=b"FWS":return sig,[],0
 if len(data)<12:return sig,[],0
 rect_bits=data[8]>>3
 pos=8+((5+4*rect_bits+7)//8)+4
 strings=[];abc_count=0
 while pos+2<=len(data):
  tag=struct.unpack_from("<H",data,pos)[0];pos+=2
  tag_code=tag>>6;length=tag&63
  if length==63:
   if pos+4>len(data):break
   length=struct.unpack_from("<I",data,pos)[0];pos+=4
  if pos+length>len(data):break
  payload=data[pos:pos+length];pos+=length
  if tag_code==82 and len(payload)>8:
   idx=payload.find(b"\0",4)
   if idx>=0:
    abc_count+=1
    strings.extend(abc_strings(payload[idx+1:]))
  if tag_code==0:break
 return sig,strings,abc_count
def sanitize(s):
 s=s.strip()
 if not SHORTSAFE.fullmatch(s):return None
 if re.search(r"(?:pass|secret|token|api_key)[=:]",s,re.I):return None
 if len(s)>=55 and re.fullmatch("[A-Za-z0-9_-]+",s):return None
 return s
def analyze(f):
 data=f.read_bytes()
 sig,all_strings,abc_count=swf_tags(data)
 endpoints={}
 for s in all_strings:
  for m in URL.finditer(s):
   try:
    u=urlsplit(m.group(0))
    if u.scheme in ("http","https") and u.netloc:
     # Drop all query/fragment components to avoid leaking credentials.
     safe=u.scheme+"://"+u.hostname+((":"+str(u.port)) if u.port else "")+u.path
     endpoints[safe]=endpoints.get(safe,0)+1
   except ValueError:continue
 contexts=[]
 for i,s in enumerate(all_strings):
  if not TARGET.search(s):continue
  cleaned=sanitize(s)
  if not cleaned:continue
  nearby=[]
  for t in all_strings[max(0,i-2):min(len(all_strings),i+3)]:
   val=sanitize(t)
   if val and val not in nearby:nearby.append(val)
  if len(contexts)<160:contexts.append({"string":cleaned,"adjacent":nearby[:5]})
 return {"file":f.name,"bytes":len(data),"signature":sig.decode("ascii","replace"),
         "abc_sections":abc_count,"abc_strings":len(all_strings),
         "endpoint_paths":sorted(endpoints),"matching_constants":contexts}
def main():
 OUTPUT.mkdir(parents=True,exist_ok=True)
 all_results=[analyze(f) for f in ASSETS]
 (OUTPUT/"report.json").write_text(json.dumps(all_results,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 print(json.dumps([{"file":d["file"],"strings":d["abc_strings"],
  "urls":len(d["endpoint_paths"]),"match":len(d["matching_constants"])} for d in all_results],ensure_ascii=False))
if __name__=="__main__":main()
