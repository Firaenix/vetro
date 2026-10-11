import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('parser', Path(__file__).with_name('parse_log.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

class ParserTests(unittest.TestCase):
    def report(self, **sections):
        return json.dumps({'format':'vetro-diagnostics','schemaVersion':1,'sections':{k:{'status':'ok','data':v} for k,v in sections.items()}})

    def test_root_success_not_persistence(self):
        r = p.analyze(self.report(platform={'running':True,'rootAgent':{'connected':True,'uid':0}}, device={'realModel':'QE50Q80AATXZT','firmware':'T-NKM2DEUC-2301.1'}))
        s = p.markdown(r)
        self.assertIn('UID 0',s)
        self.assertIn('Unknown; requires a new cold boot',s)
        self.assertIn('single tested TV',s)

    def test_disconnected_and_stopped(self):
        s = p.markdown(p.analyze(self.report(platform={'running':False,'rootAgent':{'connected':False}})))
        self.assertIn('Reported disconnected',s)
        self.assertIn('Reported stopped',s)

    def test_unknown_and_no_personal_echo(self):
        secret = 'SECRET@example.com <script> @all'
        s = p.markdown(p.analyze(self.report(device={'model':secret},mqtt={'password':secret})))
        self.assertNotIn(secret,s)
        self.assertIn('Unknown',s)

    def test_bools_are_not_uid(self):
        s = p.markdown(p.analyze(self.report(platform={'rootAgent':{'connected':True,'uid':False}})))
        self.assertNotIn('with UID 0',s)

    def test_invalid_schemas(self):
        for value in ['{}','[]','{"format":"vetro-diagnostics","schemaVersion":2}', '{bad']:
            with self.assertRaises(ValueError):p.analyze(value)

    def test_bad_section_shapes(self):
        p.analyze(json.dumps({'format':'vetro-diagnostics','schemaVersion':1,'sections':{'monitor':[],'probe':{'status':'ok','data':[]}}}))

    def test_legacy_signatures(self):
        r = p.analyze('uid=0 ECONNREFUSED EACCES SIGSEGV secret-password')
        self.assertEqual(len(r['signatures']),3)
        self.assertNotIn('secret-password',p.markdown(r))

    def test_attachment_validation(self):
        self.assertTrue(p.attachment_url('https://github.com/user-attachments/files/123/report.json'))
        self.assertTrue(p.attachment_url('https://github.com/owner/repo/files/123/report.json'))
        for u in ['http://github.com/user-attachments/files/1/r.json','https://github.com.evil.test/user-attachments/files/1/r.json','https://github.com@evil.test/r.json','https://github.com:443/user-attachments/files/1/r.json','https://github.com/user-attachments/files/1/r.zip','file:///etc/passwd','https://127.0.0.1/r.json']:
            self.assertFalse(p.attachment_url(u))
        self.assertFalse(p.download_host('https://169.254.169.254/'))
        self.assertFalse(p.download_host('https://random-bucket.s3.amazonaws.com/'))

    def test_inline_and_multiple_reports(self):
        text = self.report()
        self.assertEqual(p.report_text('```json\n'+text+'\n```'),text)
        with self.assertRaises(ValueError):p.report_text('https://github.com/user-attachments/files/1/a.json https://github.com/user-attachments/files/2/b.json')

    def test_issue_selection(self):
        self.assertTrue(p.issue_matches({'title':'[Log report] Q80','body':'### Vetro diagnostic report'}))
        self.assertFalse(p.issue_matches({'title':'ordinary issue','body':'### Vetro diagnostic report'}))

    def test_comment_updates_bot_only(self):
        calls=[]
        def api(path, token, method='GET', data=None):
            calls.append((path,method,data))
            return [{'id':12,'user':{'login':'human'},'body':p.MARKER},{'id':13,'user':{'login':'github-actions[bot]'},'body':p.MARKER}] if method=='GET' else {}
        with patch.dict('os.environ', {'GITHUB_REPOSITORY':'owner/repo','GITHUB_TOKEN':'fixture'}),patch.object(p,'api',api):p.post_comment({'number':1},p.MARKER+' report')
        self.assertEqual(calls[-1][1],'PATCH')
        self.assertTrue(calls[-1][0].endswith('/13'))

if __name__ == '__main__':unittest.main()
