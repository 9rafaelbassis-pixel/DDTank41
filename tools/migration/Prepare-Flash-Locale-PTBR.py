#!/usr/bin/env python3
"""Prepare PT-BR Flash localization WITHOUT modifying original resource identities.
Validate 3,530 keys/format markers and apply a short set of human corrections.
This is experimental localization generated from a machine translation artifact.
"""
import hashlib
import json
import re
from pathlib import Path

SOURCE=Path("Source Flash/FlashSV1/ui/vietnam/language.txt")
GENERATED=Path("translation-input/language.txt")
OUT=Path("render-web/locale/flash-ui-language.ptbr.txt")
REPORT=Path("render-web/locale/translation-quality.json")
TOKENS=re.compile(r"(</?(?:font|b|br|p|i|u|span|a|div|strong|em)\b[^<>]*>|\{\d+(?:\.\d+)?\}|\\[nr]|%[sd]|&(?:[a-z]{2,8}|#\d+);)",re.I)
VIETNAMESE=re.compile(r"[ĂăĐđƠơƯưẮắẰằẲẳẴẵẶặẠạẢảẤấẦầẨẩẪẫẬậẾếỀềỂểỄễỆệỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ]")
MANUAL={
 "AlertDialog.Error":"Erro",
 "chat.FastReplyDefaultStr":"<Padrão>",
 "AlertDialog.Info":"Informação",
 "Crazytank.ONLY_ONE_CLIENT":"Você só pode abrir uma janela do jogo por vez.",
 "CrazyTank.CLOSE_OTHER_CLIENT":"Fechando outra janela do jogo.",
 "BaseStateCreator.LoadingTip":"Carregando recursos...",
 "ddtMoney":"Cupons",
 "ddt.ConnectServerError":"Não foi possível conectar ao servidor.",
 "ServerLinkError":"Falha ao conectar ao servidor.",
 "tank.trainer.Welcome":"Olá, <font color='#a4ee91'><b>{0}</b></font>! Para ajudar você a conhecer o jogo, preparamos um tutorial de <font color='#DC801B'><b>30 segundos</b></font>. Ao concluir as atividades iniciais, você receberá <font color='#DC801B'><b>uma recompensa especial</b></font>!",
}
def marker_safe(raw,translated):
 return TOKENS.findall(raw)==TOKENS.findall(translated)
def part(key):
 return key.split(":",1)
def main():
 orig=SOURCE.read_text(encoding="utf-8-sig").splitlines()
 candidate=GENERATED.read_text(encoding="utf-8-sig").splitlines()
 if len(orig)!=len(candidate):raise RuntimeError(f"Número de linhas alterado: {len(orig)} vs {len(candidate)}")
 if len(orig)!=3530:raise RuntimeError("Esperadas exatamente 3.530 linhas da base original")
 corrected=[];keys=set();manual_count=0;pending=0
 for i,(raw,new) in enumerate(zip(orig,candidate),1):
  if ":" not in raw:
   if new!=raw:raise RuntimeError(f"Linha sem chave modificada: {i}")
   corrected.append(raw);continue
  key,old=part(raw)
  if ":" not in new:raise RuntimeError(f"Chave perdida na linha {i}")
  other,val=part(new)
  if key!=other:raise RuntimeError(f"Chave mudou na linha {i}")
  if key in MANUAL:
   val=MANUAL[key];manual_count+=1
  if not marker_safe(old,val):raise RuntimeError(f"Formatação alterada em {key}")
  if VIETNAMESE.search(val):
   val="".join("[Texto em revisão]" if VIETNAMESE.search(x) else x for x in TOKENS.split(val))
   pending+=1
  if not marker_safe(old,val):raise RuntimeError(f"Marcadores corrompidos após revisão em {key}")
  if not val.strip() and old.strip():raise RuntimeError(f"Mensagem vazia: {key}")
  if "\x00" in val or len(val)>4000:raise RuntimeError(f"Mensagem inválida: {key}")
  keys.add(key)
  corrected.append(key+":"+val)
 OUT.parent.mkdir(parents=True,exist_ok=True)
 content="\ufeff"+"\n".join(corrected)+"\n"
 OUT.write_text(content,encoding="utf-8")
 data=content.encode("utf-8")
 report={"originalLines":len(orig),"keys":len(keys),"manualOverrides":manual_count,
  "untranslatedSegmentsReplaced":pending,"sha256":hashlib.sha256(data).hexdigest(),
  "status":"PT-BR experimental por IA, revisão da comunidade necessária",
  "source":"Source Flash/FlashSV1/ui/vietnam/language.txt",
  "fallback":"O arquivo original continua em GitHub e pode ser servido com DDTANK_FLASH_PTBR=false."}
 REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
