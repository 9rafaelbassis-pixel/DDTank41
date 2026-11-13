import runpy
import unittest
m=runpy.run_path("tools/migration/Prepare-Flash-Locale-PTBR.py")
safe=m["marker_safe"]
class TestFlashMarkup(unittest.TestCase):
 def test_label_in_angles_can_be_translated(self):
  self.assertTrue(safe("<Mặc định>","<Padrão>"))
 def test_keep_html_tags_and_placeholders(self):
  original="Olá, <font color='#abc'><b>{0}</b></font>"
  translated="Oi, <font color='#abc'><b>{0}</b></font>"
  self.assertTrue(safe(original,translated))
 def test_reject_modified_html_markup(self):
  self.assertFalse(safe("<font color='#abc'><b>{0}</b></font>","<font><b>{0}</b></font>"))
if __name__=="__main__":unittest.main()
