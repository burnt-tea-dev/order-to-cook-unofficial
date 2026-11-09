#!/usr/bin/env python3
"""Read-only local Markdown links and bounded public-text privacy checks."""
import json,re
from pathlib import Path
from urllib.parse import unquote,urlparse
import verify_public_bundle as v

def main():
 preservation,inventories=v.storage();links=0;scanned=0
 # Only the new bundle is scanned; reused older artifacts are authenticated by replay.
 blocked=re.compile(r"/workspace/|/home/agent(?:/|\\b)|/root/|the parent['’]s|parent['’]s (?:independent|already)|collaboration\\.|fork_turns|agent_id|Tavern")
 for p in sorted(v.ROOT.rglob('*')):
  if p.name=='check_public_docs.py':continue
  if not p.is_file() or p.suffix in ['.jpg','.png','.tree','.gz']:continue
  data=v.bounded_read(v.member(v.ROOT,p.relative_to(v.ROOT).as_posix()),v.LIMIT)
  try:text=data.decode('utf-8')
  except UnicodeDecodeError:continue
  assert not blocked.search(text),'Private text pattern in '+str(p.relative_to(v.ROOT));scanned+=1
  if p.suffix=='.md':
   for target in re.findall(r'\[[^\]]*\]\(([^)\s]+)\)',text):
    url=urlparse(target)
    if url.scheme or target.startswith('#'):continue
    path=unquote(url.path);q=p.parent/path
    assert q.exists(),'Broken local link: '+str(p.relative_to(v.ROOT))+' -> '+target;links+=1
 converter=next(r for r in preservation['files'] if r['original_path']=='inputs/tools/convert_assets.py')
 assert not blocked.search(v.payload(converter,inventories).decode()),'Private text in compressed converter context'
 print(json.dumps({'status':'PASS local links and public-text privacy checks','local_markdown_links_checked':links,'text_files_scanned':scanned,'compressed_context_scanned':True,'scope':'Pattern scan and local-link existence, plus prior manual inspection of all nine original photographs; not a general secret-detection guarantee.'},indent=2))
if __name__=='__main__':main()
