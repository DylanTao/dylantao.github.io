from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import unquote,urlsplit
import hashlib,json
ROOT=Path.cwd();QA=ROOT/'.jekyll-cache/visual-qa/sweep-2026-10-28'
BASE=Path('C:/dev/dylantao.github.io/.jekyll-cache/visual-qa/finish-todos-2026-10-26/current-site/al-folio').resolve()
FROZEN=(QA/'frozen').resolve();assert (BASE/'index.html').exists()
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  name=unquote(urlsplit(path).path)
  if name.startswith('/al-folio/'):name=name[len('/al-folio/'):]
  else:name=name.lstrip('/')
  frozen=name.startswith('assets/js/home-scene/') or name.startswith('assets/models/home/')
  if name.startswith('assets/js/home-scene/') and name.endswith('.min.mjs'):name=name[:-8]+'.mjs'
  root=FROZEN if frozen else BASE;full=(root/name).resolve()
  self.binding=None
  if not full.is_relative_to(root):return str(root/'forbidden')
  if frozen and full.is_file():
   body=full.read_bytes();self.binding={'file':name,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'source':'frozen'}
  return str(full)
 def end_headers(self):
  self.send_header('Cache-Control','no-store')
  if getattr(self,'binding',None):
   self.send_header('X-Sweep-Sha256',self.binding['sha256']);self.send_header('X-Sweep-Source','frozen')
  super().end_headers()
 def log_message(self,*args):pass
print('Sweep4118: immutable production baseline; frozen v84/RT/cache50df family, no F6 geometry.',flush=True)
ThreadingHTTPServer(('127.0.0.1',4118),Handler).serve_forever()
