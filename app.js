'use strict';
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const pagesDemo = document.querySelector('meta[name="etrom-runtime"][content="pages-demo"]') ? import('./pages-demo.mjs') : null;
const request = async (path, options) => pagesDemo ? (await pagesDemo).demoFetch(path, options) : fetch(path, options);
const isDemoArt = src => src==='/demo-art.svg' || src==='./demo-art.svg';
const NS = 'http://www.w3.org/2000/svg';
const SVG_NAMES = new Set(['chat','book','receipt','search','quote','chevron','external','settings','photo','mic','file','send','close','audio','spark','stop','trash']);
const labels = {openai:'OpenAI',deepseek:'DeepSeek',demo:'Demo local'};
const nodes = {feed:$('#feed'), timeline:$('#timeline'), prompt:$('#prompt'), composer:$('#composer'), output:$('#output'), provider:$('#provider'), send:$('#send'), error:$('#error'), pending:$('#pending'), mic:$('#mic-button')};
const transcripts = {chat:[],classics:[]};
let cfg = {classics:[], videos:[], providers:[], preferred:'demo', maxMB:8};
let view = 'chat', attached = null, active = null, recorder = null, startingMic = false, recording = null, recordingClock, db;
const fixedSuggestions=[['Uma história','Me conta uma história'],['A conta do celular','E a conta do celular?'],['Pedir um áudio','Me manda um áudio'],['Criar imagem','Cria uma ilustração de uma xícara, uma fatura e um carimbo sobre a mesa.']];

function el(tag,cls,text) { const x=document.createElement(tag); if (cls) x.className=cls; if (text!=null) x.textContent=text; return x; }
function icon(name) { const s=document.createElementNS(NS,'svg'), u=document.createElementNS(NS,'use'); u.setAttribute('href',`#i-${SVG_NAMES.has(name)?name:'book'}`); s.setAttribute('aria-hidden','true'); s.append(u); return s; }
function link(src) {
  let u; try {u=new URL(src.url);} catch {return null;}
  if (u.protocol!=='https:') return null;
  const a=el('a','',src.label); a.href=u.href; a.target='_blank'; a.rel='noreferrer noopener'; return a;
}
function createButton(label,cls,fn) { const b=el('button',cls,label); b.type='button'; b.addEventListener('click',fn); return b; }
function preference(k,v) { try {return v===undefined ? localStorage.getItem(k) : localStorage.setItem(k,v);} catch {return null;} }
function openDb() {
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open('conversa-etrom',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('history');
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); r.onblocked=()=>reject(new Error('Armazenamento indisponível'));
  });
}
function store(mode) {
  if (!db) return;
  const keep=[];let size=0;
  for (const i of transcripts[mode].slice(-60).reverse()) {
    size+=(i.media?.length || 0);
    if (size>28*1024*1024) break;
    keep.unshift(i);
  }
  try {
    const tx=db.transaction('history','readwrite');
    tx.objectStore('history').put(keep,mode);
    tx.onerror=()=>$('#privacy-hint').textContent='Histórico não pôde ser salvo';
  } catch { $('#privacy-hint').textContent='Histórico não pôde ser salvo'; }
}
function restore(mode) {
  return new Promise(resolve=>{
    const r=db.transaction('history').objectStore('history').get(mode);
    r.onsuccess=()=>{if (Array.isArray(r.result)) transcripts[mode]=r.result; resolve();}; r.onerror=()=>resolve();
  });
}
function say(text) {
  if (!('speechSynthesis' in window)) return error('Este navegador não oferece leitura em voz alta.');
  const u=new SpeechSynthesisUtterance(text); u.lang='pt-BR';
  const voices=window.speechSynthesis.getVoices();
  u.voice=voices.find(v=>v.lang.toLowerCase()==='pt-br' && v.localService) || voices.find(v=>/^pt\b/i.test(v.lang) && v.localService) || null;
  if (!u.voice) return error('Nenhuma voz local em português disponível no navegador.');
  u.onerror=e=>{if (!['interrupted','canceled'].includes(e.error)) error('A leitura pelo navegador não está disponível.');};
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
function fmtTime(ts) { return ts ? new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(ts) : ''; }
function mediaType(src) {
  if (isDemoArt(src) || /^data:image\/(jpeg|png|webp);base64,/i.test(src)) return 'img';
  if (/^data:(audio\/(webm|ogg|mpeg|wav|mp4|x-m4a|flac)|video\/webm);base64,/i.test(src)) return 'audio';
  return null;
}
function showMessage(m) {
  const user=m.role==='user', box=el('article',`msg ${user?'user':'assistant'}`);
  if (!user) box.append(el('b','msg-name',view==='chat'?'NORA · IA':'CLÁSSICOS · COM FONTE'));
  const type=mediaType(m.media || '');
  if(type) {
    const wrap=el('div','media'), media=el(type);
    media.src=m.media;
    if(type==='img') media.alt=user?'Foto anexada':isDemoArt(m.media)?'Ilustração de demonstração':'Imagem gerada por IA';
    else {media.controls=true;media.preload='metadata';media.setAttribute('aria-label',user?'Áudio enviado':'Áudio gerado por IA');}
    wrap.append(media);box.append(wrap);
  }
  if (m.text) box.append(el('p','msg-text',m.text));
  if (m.transcript) {const d=el('details','transcript');d.append(el('summary','','Ver transcrição'),el('div','',m.transcript));box.append(d);}
  if (!user && m.localVoice && m.text) {const b=createButton('Ouvir com voz do navegador','listen',()=>say(m.text)); b.prepend(icon('audio')); box.append(b);}
  if (m.notice) box.append(el('p','msg-text',m.notice));
  if (m.sources?.length) {const refs=el('div','sources'); for (const s of m.sources) {const a=link(s);if(a)refs.append(a);} box.append(refs);}
  if (user && m.failed) {const b=createButton('Tentar de novo','listen',()=>send(m.text,m.request,m));b.disabled=!!active;box.append(b);}
  const footer=el('div','msg-meta',[user?'Você':m.provider,m.failed?'Não enviado':fmtTime(m.at)].filter(Boolean).join(' · '));box.append(footer);
  return box;
}
function renderFeed() {
  nodes.feed.replaceChildren(el('div','day',view==='chat'?'INÍCIO DA CONVERSA':'ACERVO DE REFERÊNCIAS'));
  const intro=view==='chat'?'Oi, eu sou a Nora. Assuntos de extrema importância? Café, contas e qualquer coisa que precise de um carimbo.':'Aqui é o acervo. Escolha um clássico ou pergunte pelo nome. Quando o corte não estiver confirmado, eu digo.';
  nodes.feed.append(showMessage({text:intro,provider:view==='chat'?'Personagem fictícia':'Acervo'}));
  for (const m of transcripts[view]) nodes.feed.append(showMessage(m));
  if (active?.mode===view) nodes.feed.append(el('div','typing',active.output==='image'?'Gerando imagem…':'Preparando a resposta…'));
  requestAnimationFrame(()=>nodes.timeline.scrollTop=nodes.timeline.scrollHeight);
}
function error(text='') {nodes.error.hidden=!text;nodes.error.textContent=text;}
function openVideos() {$('#videos').showModal();}
function renderNavigation() {
  $$('.side-link[data-mode],.mobile-nav [data-mode]').forEach(x=>{const on=x.dataset.mode===view;x.classList.toggle('selected',on);x.setAttribute('aria-pressed',on);});
  $('#identity-name').textContent=view==='chat'?'Nora':'Clássicos';
  $('#identity-note').textContent=view==='chat'?'Personagem fictícia · Respostas geradas por IA':'Histórias com fonte · Projeto não oficial';
  const mark=$('#identity-mark');mark.replaceChildren(view==='chat'?document.createTextNode('N'):icon('book'));
  const classes=view==='classics'; $('#media-buttons').hidden=classes; $('#output-label').hidden=classes;
  nodes.prompt.placeholder=classes?'Pergunte por um clássico…':'Escreva uma mensagem…';
  const side=$('#quick-classics');side.replaceChildren();
  const shelf=$('#suggestions');shelf.replaceChildren();
  for (const c of cfg.classics) {
    const launch=()=>classic(c);
    const b=createButton('','side-link',launch);const label=el('span','',c.title);label.append(el('small','',c.mark));b.append(icon(c.icon),label,icon('chevron'));side.append(b);
    if (classes) shelf.append(createButton(c.title,'chip',launch));
  }
  if (classes) shelf.append(createButton('Fontes e vídeos','chip',openVideos));
  else for (const [label,text] of fixedSuggestions) shelf.append(createButton(label,'chip',()=>{nodes.prompt.value=text;nodes.prompt.focus();resizeInput();}));
  setBusy();
}
function switchMode(mode) {
  if (mode===view) return true;
  if (active || recorder || startingMic) {error('Conclua o envio ou a gravação antes de trocar de conversa.');return false;}
  view=mode;nodes.prompt.value='';resizeInput();attached=null;pending();error();renderNavigation();renderFeed();return true;
}
function setBusy() {
  const waiting=!!active;
  nodes.send.disabled=waiting || !!recorder || startingMic;
  nodes.prompt.disabled=waiting;
  for (const b of $$('#photo-button,#audio-button')) b.disabled=waiting || !!recorder || startingMic;
  nodes.mic.disabled=waiting || startingMic;
  $('#clear-yes').disabled=waiting || !!recorder || startingMic;
  $$('#suggestions .chip').forEach(b=>b.disabled=waiting);
}
function classic(c) {
  if (!switchMode('classics')) return;
  send(c.title,{classicId:c.id});
}
function pending() {
  const pre=nodes.pending;pre.replaceChildren();pre.hidden=!(attached || recording);
  if(recording){pre.append(el('span','',`Gravando · ${Math.floor((Date.now()-recording.at)/1000)} s`));return;}
  if(!attached)return;
  if(attached.data.startsWith('data:image/')){const img=el('img','thumb');img.alt='';img.src=attached.data;pre.append(img);} else pre.append(icon('audio'));
  const b=createButton('','icon',()=>{attached=null;pending();});b.setAttribute('aria-label','Remover anexo');b.append(icon('close'));pre.append(el('span','',attached.name),b);
}
function resizeInput(){nodes.prompt.rows=1;nodes.prompt.rows=Math.min(4,Math.max(nodes.prompt.value.split('\n').length,Math.ceil(nodes.prompt.value.length/85)));}
const formats=new Set(['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mpeg','audio/wav','audio/mp4','audio/x-m4a','audio/flac','video/webm']);
function attach(file, name) {
  if (!file || active || view!=='chat') return;
  if (file.size>cfg.maxMB*1024*1024 || !file.size) return error(`Escolha um arquivo entre 1 byte e ${cfg.maxMB} MB.`);
  const ext=(name || file.name || '').split('.').at(-1).toLowerCase();
  const aliases={'audio/x-wav':'audio/wav','audio/mp3':'audio/mpeg','audio/x-flac':'audio/flac','application/ogg':'audio/ogg'};
  const guessed={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',m4a:'audio/mp4',mp3:'audio/mpeg',ogg:'audio/ogg',wav:'audio/wav',webm:'audio/webm',flac:'audio/flac'};
  const given=file.type.split(';')[0], mime=aliases[given] || (formats.has(given)?given:guessed[ext]);
  if(!formats.has(mime)) return error('Formato não aceito. Use JPG, PNG, WEBP ou um áudio MP3, M4A, WAV, OGG, WebM ou FLAC.');
  const reader=new FileReader();
  reader.onload=()=>{if(view!=='chat' || active)return;attached={data:reader.result.replace(/^data:[^,]*,/,`data:${mime};base64,`),name:name || file.name};pending();error();};
  reader.onerror=()=>error('Não consegui ler o arquivo.');reader.readAsDataURL(file);
}
async function record() {
  if (recorder) {recorder.stop();return;}
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return error('Microfone indisponível. Abra em HTTPS ou localhost, ou anexe um arquivo de áudio.');
  startingMic=true;setBusy();error();let stream;
  try {
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const kind=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported(x));
    const r=new MediaRecorder(stream,kind?{mimeType:kind}:undefined);const chunks=[];let failed=false;
    r.ondataavailable=e=>{if (e.data.size) chunks.push(e.data);};
    r.onerror=()=>{failed=true;error('Falha na gravação. Tente novamente ou anexe um áudio.');};
    r.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());recorder=null;recording=null;clearInterval(recordingClock);
      nodes.mic.classList.remove('recording');nodes.mic.replaceChildren(icon('mic'));nodes.mic.setAttribute('aria-label','Gravar áudio');nodes.mic.title='Gravar áudio';pending();setBusy();
      if(!failed){const mime=r.mimeType.split(';')[0], ext=mime==='audio/mp4'?'m4a':mime==='audio/ogg'?'ogg':'webm';attach(new Blob(chunks,{type:mime}),`Gravação.${ext}`);}
    };
    r.start();recorder=r;recording={at:Date.now()};nodes.mic.setAttribute('aria-label','Parar gravação');nodes.mic.title='Parar gravação';nodes.mic.replaceChildren(icon('stop'));nodes.mic.classList.add('recording');pending();
    recordingClock=setInterval(()=>{pending();if(Date.now()-recording.at>=90000 && r.state==='recording')r.stop();},400);
  } catch {stream?.getTracks().forEach(t=>t.stop());error('Não consegui acessar o microfone. Verifique a permissão ou anexe um áudio.');}
  finally {startingMic=false;setBusy();}
}
async function send(text,opts={},retry=null) {
  if (active || recorder || startingMic) return;
  const mode=view, media=retry?.media || (mode==='chat'?attached?.data:null);
  text=text.trim(); if (!text&&!media&&!opts.classicId) return;
  const output=opts.output || nodes.output.value;
  const requestOptions={output,classicId:opts.classicId};
  const stream=transcripts[mode];
  const predecessor=retry ? stream.slice(0,stream.indexOf(retry)) : stream;
  const history=predecessor.filter(m=>!m.failed).slice(-12).map(m=>({role:m.role,content:[m.text,m.transcript].filter(Boolean).join('\n')}));
  const user=retry || {role:'user',text,media,at:Date.now(),request:requestOptions};
  if(!retry){stream.push(user);nodes.prompt.value='';resizeInput();attached=null;pending();}
  user.failed=false;
  active={mode,output}; error(); setBusy(); renderFeed();
  try {
    const res=await request('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,provider:nodes.provider.value,output,text,media,history,classicId:opts.classicId}),signal:AbortSignal.timeout(155000)});
    const data=await res.json();if(!res.ok)throw new Error(data.error || 'Não consegui enviar a mensagem.');
    if(data.transcript)user.transcript=data.transcript;
    stream.push({role:'assistant',at:Date.now(),text:data.text,media:data.media,provider:data.provider,notice:data.notice,localVoice:data.localVoice,sources:data.sources});
  } catch (e) {user.failed=true;error(e instanceof TypeError?'Não consegui conectar ao servidor.':e.name==='TimeoutError'?'Tempo de resposta esgotado.':e.message);}
  finally {if(stream.length>60)stream.splice(0,stream.length-60);store(mode);active=null;setBusy();renderFeed();}
}
function configure() {
  nodes.provider.replaceChildren(...[...cfg.providers,'demo'].map(p=>{const o=el('option','',labels[p]);o.value=p;return o;}));
  const saved=preference('etrom-provider');nodes.provider.value=[...cfg.providers,'demo'].includes(saved)?saved:cfg.preferred;
  const badge=$('#connection');badge.classList.toggle('live',nodes.provider.value!=='demo');badge.textContent=nodes.provider.value==='demo'?'DEMO LOCAL':labels[nodes.provider.value]+' · API';
  $('#capabilities').textContent=pagesDemo?'Demo pública · sem acesso a provedores de IA.':`Imagem: ${cfg.image?'OpenAI configurada':'sem chave OpenAI'}. Áudio: ${cfg.audio?'ElevenLabs configurada · '+cfg.voiceLabel:'sem chave ElevenLabs'}.`;
  const list=$('#video-list');list.replaceChildren();
  for(const s of cfg.videos){const a=link(s);if(a){const li=el('li');li.append(a);list.append(li);}}
}
async function init() {
  nodes.send.disabled=true;
  const loadCfg=request('/api/config',{signal:AbortSignal.timeout(7000)}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{cfg=x;}).catch(()=>error('Não consegui carregar as configurações. Recarregue a página.'));
  const loadLocal=(async()=>{try{db=await openDb();await Promise.all([restore('chat'),restore('classics')]);}catch{$('#privacy-hint').textContent='Histórico só nesta aba';}})();
  await Promise.all([loadCfg,loadLocal]);configure();renderNavigation();renderFeed();
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
  $('#open-settings').addEventListener('click',()=>$('#settings').showModal());$('#open-videos').addEventListener('click',openVideos);
  nodes.provider.addEventListener('change',()=>{preference('etrom-provider',nodes.provider.value);configure();});
  $('#clear').addEventListener('click',()=>{$('#confirm-clear').hidden=false;});$('#clear-no').addEventListener('click',()=>{$('#confirm-clear').hidden=true;});
  $('#clear-yes').addEventListener('click',()=>{for(const m of ['chat','classics']){transcripts[m]=[];store(m);}$('#confirm-clear').hidden=true;$('#settings').close();renderFeed();error();});
  for(const kind of ['photo','audio']) {const input=$(`#${kind}-file`);$(`#${kind}-button`).addEventListener('click',()=>input.click());input.addEventListener('change',()=>{attach(input.files?.[0]);input.value='';});}
  nodes.mic.addEventListener('click',record);
  nodes.composer.addEventListener('submit',e=>{e.preventDefault();send(nodes.prompt.value);});
  nodes.prompt.addEventListener('input',resizeInput);
  nodes.prompt.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();nodes.composer.requestSubmit();}});
}
init();
