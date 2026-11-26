import {classics, videos, classicMatch, sample, normalize} from './catalog.mjs';

const config = {providers:[], preferred:'demo', image:false, audio:false, voiceLabel:'Voz local do navegador', maxMB:8, classics, videos};
export async function demoFetch(path, options={}) {
  if (path==='/api/config') return Response.json(config);
  if (path!=='/api/chat') return Response.json({error:'Rota não encontrada.'},{status:404});
  const {text='', media, output, mode, classicId} = JSON.parse(options.body);
  if (mode==='classics') {
    const item=classicMatch(text,classicId);
    return Response.json(item ? {text:item.detail,sources:item.refs,provider:'Acervo'} : {text:'Não encontrei esse clássico nas fontes verificadas. Tente “conta do celular”, “coceira”, “origem do Etrom” ou “bordões”.',provider:'Acervo'});
  }
  const q=normalize(text), image=media?.startsWith('data:image/');
  const automatic=!output || output==='auto';
  const draw=output==='image' || (automatic && /\b(?:manda|mande|envia|envie|cria|crie|gera|gere|faz|faca|desenha|desenhe)\b.{0,45}\b(?:foto|imagem|ilustracao|desenho)\b/.test(q));
  const speak=output==='voice' || (automatic && ((media && !image) || /\b(?:manda|mande|envia|envie|responde|responda)\b.{0,35}\b(?:audio|voz)\b/.test(q)));
  const provider='Demo local';
  if (draw && !media) return Response.json({provider,text:'Aqui vai uma ilustração de exemplo. A demo não gera imagens novas.',media:'./demo-art.svg'});
  const reply=media ? (image?'Recebi a imagem. Ela aparece na conversa, mas a demo não analisa fotos.':'Recebi o áudio. A demo não faz transcrição.') : sample(text);
  return Response.json({provider,text:reply,localVoice:!!speak});
}
