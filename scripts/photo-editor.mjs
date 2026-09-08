import { createServer, request } from 'node:http';
import { readFile, writeFile, rename, mkdir, mkdtemp, copyFile, unlink, readdir, realpath, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const PROCESS_IDS = Array.from({length:6}, (_,i)=>`care-process-0${i+1}`);
const GROUPS = [['care-process-', '세척 · 진행 절차'], ['care-symptom-', '세척 · 증상'], ['care-', '세척'], ['home-', '홈'], ['install-', '설치'], ['newhome-', '신축 입주'], ['commercial-', '상업용']];
const MIME = { '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg' };
const err = (status, message) => Object.assign(new Error(message), {status});
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const groupOf = id => (GROUPS.find(([prefix])=>id.startsWith(prefix)) || ['', '기타'])[1];
const exists = async p => {try {await lstat(p);return true;} catch(e) {if(e.code==='ENOENT')return false;throw e;}};
async function inside(base, target) {
  const abs=path.resolve(target);
  if (!abs.startsWith(base+path.sep)) throw err(400,'허용되지 않은 경로입니다.');
  if (await exists(abs)) {
    if((await lstat(abs)).isSymbolicLink())throw err(400,'심볼릭 링크에는 저장하지 않습니다.');
    if(!(await realpath(abs)).startsWith(base+path.sep))throw err(400,'허용되지 않은 경로입니다.');
  } else if(!(await realpath(path.dirname(abs))).startsWith(base+path.sep) && await realpath(path.dirname(abs))!==base) throw err(400,'허용되지 않은 경로입니다.');
  return abs;
}
const JSON_STRING='"(?:[^"\\\\]|\\\\.)*"';
const OBJECT_BODY='(?:'+JSON_STRING+'|[^{}"])*';
function setKey(inner,key,value) {
  const re=new RegExp('("'+key+'"\\s*:\\s*)'+JSON_STRING,'g');
  if([...inner.matchAll(re)].length!==1)throw err(409,'수정할 필드를 정확히 하나 찾지 못했습니다.');
  return inner.replace(re,(_m,prefix)=>prefix+JSON.stringify(value));
}
function replaceRegistryEntry(text,id,src,alt) {
  const re=new RegExp('("'+esc(id)+'"\\s*:\\s*\\{)('+OBJECT_BODY+')(\\})','g');
  if([...text.matchAll(re)].length!==1)throw err(409,'사진 항목이 중복되거나 변경됐습니다.');
  return text.replace(re,(_m,open,body,close)=>open+setKey(setKey(body,'src',src),'alt',alt)+close);
}
function replaceProcessImage(text,step,src) {
  const re=new RegExp('\\{'+OBJECT_BODY+'\\}','g');let count=0;
  const next=text.replace(re,full=>{const obj=JSON.parse(full);if(obj.step!==step || typeof obj.image!=='string')return full;count++;return '{'+setKey(full.slice(1,-1),'image',src)+'}';});
  if(count!==1)throw err(409,'진행 절차 항목을 정확히 하나 찾지 못했습니다.');return next;
}

export async function start(root,port=4318) {
  root=await realpath(root);
  const mediaDir=path.join(root,'public/media'), backupRoot=path.join(root,'.photo-editor-backups');
  await mkdir(backupRoot,{recursive:true});
  const mediaReal=await realpath(mediaDir), backupReal=await realpath(backupRoot);
  if(!mediaReal.startsWith(root+path.sep)||backupReal!==backupRoot)throw err(400,'미디어 또는 백업 폴더 경로를 확인하세요.');
  const registryPath=await inside(root,path.join(root,'src/content/site/image-slots.json'));
  const pricingPath=await inside(root,path.join(root,'src/content/site/pricing.json'));
  const token=randomBytes(24).toString('hex');let writing=false;
  async function loadSlots() {
    const reg=JSON.parse(await readFile(registryPath,'utf8')),pr=JSON.parse(await readFile(pricingPath,'utf8'));
    const slots=Object.entries(reg.slots).map(([id,v])=>({id,group:groupOf(id),kind:'registry',src:v.src,alt:v.alt}));
    for(const id of PROCESS_IDS){const step=pr.process.find(s=>s.step===Number(id.slice(-2)));if(!step)throw err(500,'진행 절차가 누락됐습니다.');slots.push({id,group:groupOf(id),kind:'process',src:step.image,alt:step.title+' 작업 사진',auto:true});}
    if(slots.some(s=>!/^[-a-z0-9]+$/.test(s.id)))throw err(500,'잘못된 사진 식별자입니다.');return slots;
  }
  async function save(id,body,altHeader) {
    let slots=await loadSlots();const slot=slots.find(s=>s.id===id);if(!slot)throw err(404,'알 수 없는 사진 위치입니다.');
    const alt=slot.auto?slot.alt:Buffer.from(altHeader||'','base64').toString('utf8').trim();
    if(!alt||alt.length>300)throw err(400,'사진 설명을 1~300자로 입력하세요.');
    if(!body.length)throw err(400,'사진이 비어 있습니다.');
    // Decode only raster formats; vector content is rejected before rendering.
    const jpeg=body[0]===255&&body[1]===216&&body[2]===255;
    const png=body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp=body.toString('ascii',0,4)==='RIFF'&&body.toString('ascii',8,12)==='WEBP';
    if(!jpeg&&!png&&!webp)throw err(400,'JPEG · PNG · WebP 사진만 사용할 수 있습니다.');
    let out;
    try {const img=sharp(body,{limitInputPixels:MAX_PIXELS});const meta=await img.metadata();if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)throw Error('정지 사진만 지원합니다.');out=await img.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).webp({quality:90}).toBuffer();}
    catch{throw err(400,'사진을 해석하지 못했습니다. 4천만 화소 이하의 정지 사진을 선택하세요.');}
    const fileName=id+'-manual.webp',newSrc='/media/'+fileName;
    slots=await loadSlots();if(slots.some(s=>s.id!==id&&s.src===newSrc))throw err(409,'다른 위치가 사용하는 파일입니다.');
    const target=await inside(mediaReal,path.join(mediaReal,fileName));
    const jsonPath=slot.auto?pricingPath:registryPath;
    const text=await readFile(jsonPath,'utf8');
    const current=slots.find(s=>s.id===id);if(!current||current.src!==slot.src||current.alt!==slot.alt)throw err(409,'사진 정보가 변경됐습니다. 새로고침하세요.');
    const next=slot.auto?replaceProcessImage(text,Number(id.slice(-2)),newSrc):replaceRegistryEntry(text,id,newSrc,alt);
    const parsed=JSON.parse(next);assert.equal(slot.auto?parsed.process.find(s=>s.step===Number(id.slice(-2))).image:parsed.slots[id].src,newSrc);
    const backupDir=await inside(backupReal,path.join(backupReal,new Date().toISOString().replace(/[:.]/g,'-')+'-'+id+'-'+randomBytes(4).toString('hex')));
    await mkdir(backupDir);await writeFile(path.join(backupDir,path.basename(jsonPath)),text,{flag:'wx'});
    if(/^\/media\/[a-zA-Z0-9._-]+$/.test(current.src)){const old=await inside(mediaReal,path.join(mediaReal,path.basename(current.src)));if(await exists(old))await copyFile(old,path.join(backupDir,'previous-'+path.basename(old)));}
    const hadOld=await exists(target);if(hadOld)await copyFile(target,path.join(backupDir,fileName));
    const suffix='.'+randomBytes(8).toString('hex')+'.tmp',tmpImg=target+suffix,tmpJson=jsonPath+suffix;let imageWritten=false;
    try {
      await writeFile(tmpImg,out,{flag:'wx'});await writeFile(tmpJson,next,{flag:'wx'});
      if(await readFile(jsonPath,'utf8')!==text)throw err(409,'외부 수정이 감지됐습니다. 새로고침 후 다시 저장하세요.');
      await rename(tmpImg,target);imageWritten=true;await rename(tmpJson,jsonPath);
    } catch(e) {if(imageWritten){if(hadOld)await copyFile(path.join(backupDir,fileName),target);else await unlink(target);}throw e;}
    finally{await unlink(tmpImg).catch(()=>{});await unlink(tmpJson).catch(()=>{});}
    return {ok:true,id,src:newSrc,alt,backup:path.relative(root,backupDir)};
  }
  function readBody(req) {return new Promise((resolve,reject)=>{const chunks=[];let n=0,done=false;const fail=e=>{if(done)return;done=true;req.resume();reject(e);};req.on('data',c=>{if(done)return;n+=c.length;if(n>MAX_BYTES)return fail(err(413,'20MB 이하의 사진을 선택하세요.'));chunks.push(c);});req.on('end',()=>{if(!done){done=true;resolve(Buffer.concat(chunks));}});req.on('error',()=>fail(err(400,'업로드가 끊겼습니다.')));req.on('aborted',()=>fail(err(400,'업로드가 중단됐습니다.')));});}
  const server=createServer(async(req,res)=>{
    const send=(status,body,type='application/json; charset=utf-8')=>{if(!req.readableEnded)req.resume();res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY'});res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));};
    try {
      const origin='http://127.0.0.1:'+server.address().port;
      if(req.headers.host!=='127.0.0.1:'+server.address().port||req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'허용되지 않은 출처입니다.'});
      if(req.method==='OPTIONS')return send(405,{error:'지원하지 않는 요청입니다.'});
      const url=new URL(req.url,origin),seg=url.pathname.split('/').filter(Boolean);
      if(req.method==='GET'&&url.pathname==='/')return send(200,page(token),'text/html; charset=utf-8');
      if(req.method==='GET'&&url.pathname==='/api/slots')return send(200,{slots:await loadSlots()});
      if(req.method==='GET'&&seg[0]==='api'&&seg[1]==='image'&&seg.length===3){const slot=(await loadSlots()).find(s=>s.id===decodeURIComponent(seg[2]));if(!slot||!/^\/media\/[A-Za-z0-9._-]+$/.test(slot.src))return send(404,{error:'등록된 사진이 없습니다.'});const file=await inside(mediaReal,path.join(mediaReal,path.basename(slot.src)));return send(200,await readFile(file),MIME[path.extname(file)]||'application/octet-stream');}
      if(req.method==='POST'&&seg[0]==='api'&&seg[1]==='photo'&&seg.length===3){
        if(req.headers.origin!==origin||req.headers['x-csrf-token']!==token)return send(403,{error:'페이지를 새로고침해 주세요.'});
        if(writing)return send(409,{error:'다른 사진을 저장하고 있습니다. 잠시 후 다시 저장하세요.'});
        writing=true;try{return send(200,await save(decodeURIComponent(seg[2]),await readBody(req),req.headers['x-photo-alt']));}finally{writing=false;}
      }
      return send(404,{error:'경로를 찾을 수 없습니다.'});
    }catch(e){if(!res.headersSent)send(e.status||500,{error:e.message});}
  });
  server.requestTimeout=30000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,port:server.address().port,token};
}

function page(token) {return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>바람대로 사진 교체</title><style>
:root{--teal:#004E64;--base:#F7F9FA;--line:#E0E5E9;--ink:#0B2027}*{box-sizing:border-box}body{margin:0;background:var(--base);color:var(--ink);font-family:system-ui,-apple-system,sans-serif;line-height:1.55}header{background:var(--teal);color:white;padding:24px}h1{margin:0 0 8px;font-size:24px}header p{margin:0}main{max-width:1440px;margin:auto;padding:24px;display:grid;gap:20px;grid-template-columns:repeat(3,minmax(0,1fr))}.card{background:white;border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px}.grp{font-weight:600;color:var(--teal)}.sid{font-size:13px;overflow-wrap:anywhere;color:#465D68}.thumb{height:260px;border-radius:12px;background:var(--base);display:grid;place-items:center;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:contain}.drop{border:2px dashed var(--line);border-radius:12px;padding:16px;text-align:center}.drop.over{border-color:var(--teal);background:#BFE9F2}input[type=text]{width:100%;min-height:44px;padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit}button{min-height:44px;border:1px solid var(--teal);border-radius:12px;padding:8px 16px;font:inherit;background:var(--teal);color:white;cursor:pointer}.pick{background:white;color:var(--teal)}button:disabled{opacity:.5;cursor:default}:focus-visible{outline:3px solid var(--teal);outline-offset:3px}.st{font-size:14px;min-height:24px;overflow-wrap:anywhere}.auto{font-size:14px;color:#465D68}@media(max-width:1000px){main{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){main{grid-template-columns:1fr;padding:16px}}
</style><header><h1>바람대로 사진 교체</h1><p>사진을 끌어 넣고 저장하세요. 이 컴퓨터에 저장되며, 운영 사이트 반영에는 배포가 필요합니다. 기존 사진은 자동으로 백업합니다.</p></header><p id="global" role="status" aria-live="polite"></p><main id="app"></main><script>
const TOKEN=${JSON.stringify(token)};const app=document.getElementById('app');
const enc=t=>btoa(String.fromCharCode(...new TextEncoder().encode(t)));
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
fetch('/api/slots').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);d.slots.forEach(render);}).catch(e=>document.getElementById('global').textContent=e.message);
function render(s){
 const c=document.createElement('section');c.className='card';c.dataset.slot=s.id;
 c.innerHTML='<div class="grp"></div><div class="sid"></div><div class="thumb"><span>등록된 사진 없음</span></div><div class="drop">사진을 여기로 끌어다 놓으세요</div><button class="pick" type="button">사진 선택</button><input type="file" accept="image/jpeg,image/png,image/webp" hidden>'+(s.auto?'<p class="auto">사진 설명은 진행 절차 제목에서 자동으로 표시됩니다.</p>':'<label>사진 설명<input type="text" maxlength="300"></label>')+'<button class="save" type="button">저장</button><p class="st" role="status" aria-live="polite"></p>';
 c.querySelector('.grp').textContent=s.group;c.querySelector('.sid').textContent=s.id;
 const thumb=c.querySelector('.thumb'),drop=c.querySelector('.drop'),fi=c.querySelector('input[type=file]'),pick=c.querySelector('.pick'),alt=c.querySelector('input[type=text]'),btn=c.querySelector('.save'),st=c.querySelector('.st');
 if(alt)alt.value=s.alt;let file=null,previewUrl=null,busy=false;
 function show(src){thumb.replaceChildren();const img=document.createElement('img');img.alt=alt?alt.value:s.alt;img.src=src;thumb.append(img);}
 if(s.src)show('/api/image/'+encodeURIComponent(s.id)+'?v='+Date.now());
 function take(f){if(busy||!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>20*1024*1024){st.textContent='JPEG · PNG · WebP 형식의 20MB 이하 사진을 선택하세요.';return;}if(previewUrl)URL.revokeObjectURL(previewUrl);file=f;previewUrl=URL.createObjectURL(f);show(previewUrl);drop.textContent=f.name;st.textContent='사진 선택됨 · 저장 버튼을 눌러주세요.';}
 pick.addEventListener('click',()=>fi.click());fi.addEventListener('change',()=>take(fi.files[0]));
 ['dragenter','dragover'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();if(!busy)drop.classList.add('over');}));
 ['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('over');}));
 drop.addEventListener('drop',ev=>take(ev.dataTransfer.files[0]));
 // Dropping directly on the photo is also supported.
 thumb.addEventListener('dragover',ev=>ev.preventDefault());thumb.addEventListener('drop',ev=>{ev.preventDefault();take(ev.dataTransfer.files[0]);});
 btn.addEventListener('click',async()=>{
  if(!file){st.textContent='사진을 먼저 선택하세요.';return;}if(alt&&!alt.value.trim()){st.textContent='사진 설명을 입력하세요.';return;}
  busy=true;c.setAttribute('aria-busy','true');btn.disabled=pick.disabled=fi.disabled=true;if(alt)alt.disabled=true;st.textContent='저장 중…';
  try{const headers={'content-type':file.type,'x-csrf-token':TOKEN};if(alt)headers['x-photo-alt']=enc(alt.value.trim());const r=await fetch('/api/photo/'+encodeURIComponent(s.id),{method:'POST',headers,body:file});const j=await r.json();if(!r.ok)throw Error(j.error);st.textContent='저장했습니다. 기존 사진도 백업했습니다.';show('/api/image/'+encodeURIComponent(s.id)+'?v='+Date.now());file=null;fi.value='';drop.textContent='다른 사진으로 바꾸려면 끌어다 놓으세요';if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}}
  catch(e){st.textContent=e.message;}finally{busy=false;c.removeAttribute('aria-busy');btn.disabled=pick.disabled=fi.disabled=false;if(alt)alt.disabled=false;}
 });app.append(c);
}
</script></html>`;}

async function selfTest(){
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'photo-editor-')));let server;
 try{
  await mkdir(path.join(root,'public/media'),{recursive:true});await mkdir(path.join(root,'src/content/site'),{recursive:true});
  const reg=path.join(root,'src/content/site/image-slots.json'),pri=path.join(root,'src/content/site/pricing.json');
  const original='{\n "slots": {\n "home-test": { "src": "/media/shared.webp", "alt": "old {test}" },\n "home-other": { "src": "/media/shared.webp", "alt": "other" }\n }, "note": "PRESERVE"\n}\n';
  await writeFile(reg,original);await writeFile(pri,JSON.stringify({process:PROCESS_IDS.map((id,i)=>({step:i+1,title:'절차 '+i,body:'preserve {body}',image:''}))},null,2));
  const png=await sharp({create:{width:60,height:40,channels:3,background:'#004E64'}}).png().toBuffer();await writeFile(path.join(root,'public/media/shared.webp'),await sharp(png).webp().toBuffer());
  const started=await start(root,0);server=started.server;const base='http://127.0.0.1:'+started.port;
  const post=(id,body=png,extra={})=>fetch(base+'/api/photo/'+encodeURIComponent(id),{method:'POST',body,headers:{origin:base,'x-csrf-token':started.token,'x-photo-alt':Buffer.from('교체 사진 {new}').toString('base64'),...extra}});
  assert.equal((await post('home-test')).status,200);const after=await readFile(reg,'utf8');assert.equal(after,replaceRegistryEntry(original,'home-test','/media/home-test-manual.webp','교체 사진 {new}'));
  assert.equal((await post('care-process-02')).status,200);assert.equal(JSON.parse(await readFile(pri)).process[1].image,'/media/care-process-02-manual.webp');
  assert.equal((await post('unknown')).status,404);assert.equal((await post('../../outside')).status,404);
  assert.equal((await post('home-test',Buffer.from('<svg/>'))).status,400);assert.equal((await post('home-test',Buffer.alloc(MAX_BYTES+1))).status,413);
  assert.equal((await post('home-test',png,{origin:'http://elsewhere.invalid'})).status,403);assert.equal((await post('home-test',png,{'x-csrf-token':'wrong'})).status,403);
  assert.equal((await post('home-test',png,{'x-photo-alt':''})).status,400);
  assert.equal((await fetch(base+'/',{method:'OPTIONS'})).status,405);
  assert.equal(await new Promise((resolve,reject)=>{const req=request(base+'/',{headers:{host:'example.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();}),403);
  assert.equal((await fetch(base+'/api/image/'+encodeURIComponent('../package.json'))).status,404);
  const saved=Buffer.from(await(await fetch(base+'/api/image/home-test')).arrayBuffer());assert.equal((await sharp(saved).metadata()).format,'webp');
  const backups=await readdir(path.join(root,'.photo-editor-backups'));assert.equal(backups.length,2);
  assert.ok((await readdir(path.join(root,'.photo-editor-backups',backups.find(x=>x.includes('home-test'))))).includes('previous-shared.webp'));
  await new Promise(r=>server.close(r));server=null;
  const again=await start(root,0);server=again.server;const slots=(await(await fetch('http://127.0.0.1:'+again.port+'/api/slots')).json()).slots;assert.equal(slots.find(s=>s.id==='home-test').src,'/media/home-test-manual.webp');
  console.log('PASS: registry/process save, unrelated JSON preservation, backups, raster validation, limits, paths, origins, token, restart persistence');
 }finally{if(server)await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--self-test'))await selfTest();
 else{const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');try{const {port}=await start(root);const url='http://127.0.0.1:'+port+'/';console.log('사진 교체: '+url+' · 종료: Ctrl+C');if(!process.argv.includes('--no-open'))spawn('open',[url],{stdio:'ignore'}).on('error',()=>{});}catch(e){console.error(e.code==='EADDRINUSE'?'사진 편집기가 이미 실행 중입니다: http://127.0.0.1:4318/':e.message);process.exitCode=1;}}
}
