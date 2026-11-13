import runpy
import unittest
from pathlib import Path

module = runpy.run_path("tools/migration/Translate-Flash-Language-PTBR.py")
TOKENS = module["TOKENS"]
eligible = module["eligible"]

class FlashLocaleSafety(unittest.TestCase):
    def test_markup_is_never_translated(self):
        for x in ["<font color='#a4ee91'>", "<b>", "</font>", "{0}", "{2}", r"\n", "%s"]:
            self.assertFalse(eligible(x), x)
        self.assertTrue(eligible("Để giúp đỡ bạn"))
    def test_full_original_welcome_has_unchanged_markers(self):
        lines=Path("Source Flash/FlashSV1/ui/vietnam/language.txt").read_text(encoding="utf-8-sig").splitlines()
        value=next(line.split(":",1)[1] for line in lines if line.startswith("tank.trainer.Welcome:"))
        parts=TOKENS.split(value)
        rewritten="".join("[Texto em português]" if eligible(part) else part for part in parts)
        self.assertEqual(TOKENS.findall(value), TOKENS.findall(rewritten))
        self.assertIn("{0}", rewritten)
        self.assertIn("<font color='#a4ee91'>", rewritten)
    def test_original_locale_preserved_without_translation(self):
        text=Path("Source Flash/FlashSV1/ui/vietnam/language.txt").read_text(encoding="utf-8-sig")
        for line in text.splitlines():
            if ":" not in line: continue
            value=line.split(":",1)[1]
            rewritten="".join("Texto PT-BR" if eligible(part) else part for part in TOKENS.split(value))
            self.assertEqual(TOKENS.findall(value),TOKENS.findall(rewritten))

if __name__=="__main__":
    unittest.main()
