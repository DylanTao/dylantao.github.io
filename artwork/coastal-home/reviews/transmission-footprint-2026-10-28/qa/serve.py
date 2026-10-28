from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse
import hashlib, mimetypes, json
Q=Path(__file__).resolve().parent
BASE=Q/'baseline-site/al-folio'
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  rel=unquote(urlparse(self.path).path)
  if not rel.startswith('/al-folio/'): self.send_error(404); return
  rel=rel[len('/al-folio/'):]
  if not rel or rel.endswith('/'): rel+='index.html'
  target=(BASE/rel).resolve()
  if not target.is_relative_to(BASE.resolve()) or not target.is_file(): self.send_error(404); return
  body=target.read_bytes()
  self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(target)[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Roi-Source','complete-frozen-scene-lifetime');self.send_header('X-Roi-Sha256',hashlib.sha256(body).hexdigest());self.end_headers();self.wfile.write(body)
 def log_message(self,*args): pass
class Server(ThreadingHTTPServer): allow_reuse_address=False
print('Owned frozen baseline http://127.0.0.1:4136/al-folio/',flush=True)
Server(('127.0.0.1',4136),Handler).serve_forever()
