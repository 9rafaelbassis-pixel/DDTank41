#!/usr/bin/env python3
"""Draft the original Flash UI language file in PT-BR without changing resource keys.
The translations are NOT official: review the output for game-specific terminology.
"""
from __future__ import annotations
import csv
import json
import os
import re
from pathlib import Path

SOURCE = Path("Source Flash/FlashSV1/ui/vietnam/language.txt")
OUTDIR = Path("translation-output/flash-ui")
# Identifiers, placeholders, markup, and escapes must be preserved EXACTLY.
TOKENS = re.compile(r"(<[^<>]*>|\{\d+(?:\.\d+)?\}|\\[nr]|%[sd]|&(?:[a-z]{2,8}|#\d+);)")
WORDS = re.compile(r"[\p{L}]", flags=0) if False else re.compile(r"[A-Za-zÀ-ỹ]", re.UNICODE)
VI_UNIQUE = re.compile(r"[ĂăĐđƠơƯưẮắẰằẲẳẴẵẶặẠạẢảÃãẤấẦầẨẩẪẫẬậẾếỀềỂểỄễỆệỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ]")
PROTECTED_KEYS = {"Tank.auctionHouse.view.BaseStripView.Font"}
DEFAULT_NAMES = {"ok":"OK","sure":"OK","close":"Fechar","clear":"Limpar","get":"Receber","modify":"Editar",
 "cancel":"Cancelar","money":"Cupons","gold":"Ouro","yes":"Sim","no":"Não","tips":"Dicas",
 "fail":"Falha","second":"segundo","load":"Carregar","alert":"Aviso","gift":"Moedas especiais",
 "medal":"Medalhas"}
def translate(texts, name, prefix=""):
 import torch
 from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
 torch.set_num_threads(min(4,os.cpu_count() or 2))
 tokenizer=AutoTokenizer.from_pretrained(name)
 model=AutoModelForSeq2SeqLM.from_pretrained(name)
 model.eval()
 results=[]
 with torch.inference_mode():
  for at in range(0,len(texts),32):
   batch=[prefix+s for s in texts[at:at+32]]
   inputs=tokenizer(batch,padding=True,truncation=True,return_tensors="pt",max_length=130)
   decoded=model.generate(**inputs,max_new_tokens=140,num_beams=1)
   results.extend(tokenizer.batch_decode(decoded,skip_special_tokens=True))
   if at%512==0:print(f"{name}: {at}/{len(texts)}",flush=True)
 del model
 return results
def lines_with_keys(source):
 result=[]
 for original in source.splitlines():
  if ":" not in original:
   result.append((original,None,None))
  else:
   key,value=original.split(":",1)
   result.append((original,key,value))
 return result
def eligible(segment):
 return bool(WORDS.search(segment)) and len(segment.strip())>=2 and "://" not in segment
def sanitize(value):
 value=" ".join(value.strip().split())
 value=value.removeprefix(">>pt_BR<<").strip()
 return value
def main():
 source=SOURCE.read_text(encoding="utf-8-sig")
 lines=lines_with_keys(source)
 unique={}
 for _,key,value in lines:
  if key is None or key in PROTECTED_KEYS or key.startswith("#"):continue
  for part in TOKENS.split(value):
   if eligible(part) and part not in unique:
    unique[part]=None
 phrases=list(unique)
 print("Linhas:",len(lines),"Trechos textuais únicos:",len(phrases),flush=True)
 english=translate(phrases,"Helsinki-NLP/opus-mt-vi-en")
 pt=translate(english,"Helsinki-NLP/opus-mt-en-ROMANCE",prefix=">>pt_BR<< ")
 suggestions={src:sanitize(x) for src,x in zip(phrases,pt)}
 output=[];report=[];fallback=0
 for original,key,value in lines:
  if key is None or key.startswith("#"):
   output.append(original);continue
  if key in PROTECTED_KEYS:
   output.append(original);continue
  if key in DEFAULT_NAMES:
   label=DEFAULT_NAMES[key];status="dicionario"
  else:
   original_parts=TOKENS.split(value)
   result=[]
   forced=False
   for part in original_parts:
    if eligible(part):
     labelpart=suggestions.get(part,"")
     # This is NOT a fake translation: flag a visible generic label if the model
     # failed to produce usable PT-BR. Do not expose Vietnamese-only glyphs.
     if not labelpart or VI_UNIQUE.search(labelpart) or (labelpart==part and VI_UNIQUE.search(part)):
      labelpart="[Texto pendente de revisão]"
      forced=True
     result.append(labelpart)
    else: result.append(part)
   label="".join(result);status="pendente_de_revisao" if forced else "traducao_automatica_revisar"
  if any(token not in label for token in TOKENS.findall(value)):
   raise RuntimeError("Token de formatação foi perdido na chave: "+key)
  if VI_UNIQUE.search(label):
   label="[Mensagem pendente de revisão]"
   status="pendente_de_revisao"
  if len(label)>2500:
   label="[Mensagem longa pendente de revisão]"
   status="pendente_de_revisao"
  output.append(key+":"+label)
  report.append({"chave":key,"original":value,"ptbr":label,"status":status})
  if status=="pendente_de_revisao":fallback+=1
 OUTDIR.mkdir(parents=True,exist_ok=True)
 (OUTDIR/"language.txt").write_text("\ufeff"+"\n".join(output)+"\n",encoding="utf-8")
 with (OUTDIR/"language-review.csv").open("w",newline="",encoding="utf-8-sig") as f:
  writer=csv.DictWriter(f,fieldnames=["chave","original","ptbr","status"]);writer.writeheader();writer.writerows(report)
 summary={"lines":len(lines),"entries":len(report),"translated_text_chunks":len(phrases),
          "needs_manual_review":fallback,"source":str(SOURCE),
          "note":"PT-BR auto-generated, not official. Source keys and formatting preserved."}
 (OUTDIR/"report.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(summary,ensure_ascii=False),flush=True)
if __name__=="__main__":main()
