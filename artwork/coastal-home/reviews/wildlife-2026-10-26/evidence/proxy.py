from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlparse
import mimetypes
ROOT=Path(__file__).resolve().parents[3]
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  relative=urlparse(self.path).path.removeprefix('/al-folio/').removeprefix('/')
  if relative.startswith(('assets/js/home-scene/','assets/models/home/')):
   source_root=Path(r'C:/dev/dylantao.github.io') if relative.startswith('assets/models/home/') else ROOT
   p=(source_root/relative).resolve()
   if p.is_file() and p.is_relative_to(source_root):
    body=p.read_bytes()
    if relative=='assets/js/home-scene/wildlife-neighbor-motion.mjs' and (ROOT/'.jekyll-cache/visual-qa/wildlife-2026-10-26/motion-mode.txt').read_text().strip()=='before':body=(ROOT/'.jekyll-cache/visual-qa/wildlife-2026-10-26/before-neighbor-motion.mjs').read_bytes()
    if relative=='assets/js/home-scene/environment.mjs':body=body.decode().replace('captureSeabed: (roots) => {', 'captureSeabed: (roots) => {\n      wildlife.captureGround([scene]);').encode()
    self.send_response(200);self.send_header('Content-Type','text/javascript' if p.suffix in ('.mjs','.js') else 'model/gltf-binary' if p.suffix=='.glb' else 'application/json');self.end_headers();self.wfile.write(body);return
  try:
   with urlopen('http://127.0.0.1:4104'+self.path,timeout=60) as r:
    self.send_response(r.status)
    for k,v in r.headers.items():
     if k.lower() in ('content-type','cache-control'):self.send_header(k,v)
    self.end_headers();self.wfile.write(r.read())
  except Exception:self.send_error(502)
class Server(ThreadingHTTPServer):request_queue_size=256
print('Wildlife source proxy4105:',ROOT,flush=True)
Server(('127.0.0.1',4105),Handler).serve_forever()
