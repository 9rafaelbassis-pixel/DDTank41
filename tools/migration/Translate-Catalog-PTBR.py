#!/usr/bin/env python3
"""Offline Vietnamese -> English -> Brazilian Portuguese model inference for DDTank item labels.
Translates public *item names* only. No player records or user data leave the runner.
Machine-generated labels must be reviewed by fluent players; the source name/ID are preserved.
"""
import argparse
import csv
import json
import os
import re
from pathlib import Path

VI_MARKERS = re.compile(r"[ĂăĐđƠơƯưẠ-ỹ]", re.UNICODE)
GENERIC_TYPES = {
    1: "Acessório de cabeça", 2: "Óculos ou rosto", 3: "Cabelo", 4: "Roupas",
    5: "Rosto", 6: "Equipamento", 7: "Arma", 8: "Equipamento", 9: "Acessório",
    10: "Consumível", 11: "Item especial", 12: "Item especial", 32: "Item de fazenda"
}
SOURCE_MODELS = ("Helsinki-NLP/opus-mt-vi-en", "Helsinki-NLP/opus-mt-en-ROMANCE")
def load_rows(directory):
    data = {}
    files=sorted(Path(directory).glob("catalog-*.json"))
    if not files:
        raise RuntimeError("Sem arquivos catalog-XXXX.json — baixe o artifact SQL primeiro")
    for file in files:
        rows=json.loads(file.read_text(encoding="utf-8-sig"))
        if not isinstance(rows,list):raise RuntimeError(f"Lote inesperado: {file}")
        for row in rows:
            key=int(row["TemplateID"])
            data[key]=row
    return [data[k] for k in sorted(data)]
def translate_strings(texts, modelname, prefix=""):
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    torch.set_num_threads(min(4,os.cpu_count() or 2))
    print("Carregando modelo (CPU):",modelname,flush=True)
    tok=AutoTokenizer.from_pretrained(modelname)
    model=AutoModelForSeq2SeqLM.from_pretrained(modelname)
    model.eval()
    output=[]
    with torch.inference_mode():
        for i in range(0,len(texts),32):
            items=[prefix+x for x in texts[i:i+32]]
            encoded=tok(items,return_tensors="pt",padding=True,truncation=True,max_length=72)
            generated=model.generate(**encoded,max_new_tokens=72,num_beams=1)
            output.extend(tok.batch_decode(generated,skip_special_tokens=True))
            if i%512==0:print(modelname,i,"/",len(texts),flush=True)
    del model
    return output
def clean_pt_label(translated,original,row):
    translated=" ".join(translated.strip().split())
    translated=translated.removeprefix(">>pt_BR<<").strip()
    if not translated or len(translated)>150 or VI_MARKERS.search(translated):
        category=GENERIC_TYPES.get(int(row.get("CategoryID",0)),"Item")
        return f"{category} #{row['TemplateID']}", "rótulo_genérico_revisar"
    # Names kept unchanged despite Vietnamese markers are NOT a valid complete translation.
    if translated.casefold()==original.casefold() and VI_MARKERS.search(original):
        category=GENERIC_TYPES.get(int(row.get("CategoryID",0)),"Item")
        return f"{category} #{row['TemplateID']}", "rótulo_genérico_revisar"
    return translated, "tradução_automática_revisar"
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",default="translation-input")
    parser.add_argument("--output",default="translation-output")
    args=parser.parse_args()
    rows=load_rows(args.input)
    print("Itens originais encontrados:",len(rows),flush=True)
    names=list(dict.fromkeys(str(x["Name"]).strip() for x in rows))
    english=translate_strings(names,SOURCE_MODELS[0])
    portuguese=translate_strings(english,SOURCE_MODELS[1],prefix=">>pt_BR<< ")
    translated=dict(zip(names,portuguese))
    results=[]; counts={}
    for row in rows:
        original=str(row["Name"]).strip()
        label,status=clean_pt_label(translated[original],original,row)
        counts[status]=counts.get(status,0)+1
        result=dict(row)
        result.update({"NameOriginal":original,"NamePTBR":label,
           "StatusTraducao":"automatica_parcial",
           "RevisaoObrigatoria":True,
           "OrigemRotulo":status})
        results.append(result)
    output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
    (output/"ddtank-catalogo-ptbr-ia-revisao.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    with (output/"ddtank-catalogo-ptbr-ia-revisao.csv").open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=["TemplateID","CategoryID","NameOriginal","NamePTBR","StatusTraducao","OrigemRotulo"])
        writer.writeheader();writer.writerows({key:row.get(key,"") for key in writer.fieldnames} for row in results)
    report={"total":len(results),"unique_source_names":len(names),"counts":counts,"review_required":True,"models":SOURCE_MODELS}
    (output/"translation-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False),flush=True)
if __name__=="__main__":main()
