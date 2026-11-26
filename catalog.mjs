export const classics = [
  {id:'conta', title:'A conta do celular', mark:'Post original', icon:'receipt', detail:'Num post de 16/07/2026, a autora diz que já imprimiu a conta do celular para pagá-la. A publicação confirma a história da fatura, mas não qual vídeo viralizou.', refs:[{label:'Blog Ministério Etrom · 16/07/2026',url:'https://ministerioetrom.blogspot.com/2026/07/rede-globo-amada-e-governo-federal-do_0447997069.html'}]},
  {id:'coceira', title:'A história da coceira', mark:'Corte não confirmado', icon:'search', detail:'Um post de fevereiro de 2023 fala em comprar outra pomada. Em outro registro, uma matéria cita a expressão “ânus destruído”. Não encontrei o corte exato da coceira nem evidência de que os dois relatos sejam a mesma história.', refs:[{label:'Blog Ministério Etrom · fevereiro/2023',url:'https://ministerioetrom.blogspot.com/2023/02/ministra-carmen-lucia-e-rede-globo_16.html'},{label:'BreakTudo · trecho citado',url:'https://www.breaktudo.com/viral-no-tiktok-ministerio-etrom-o-caso-da-mulher-que-xinga-pessoas-aleatorias-odeia-o-saymon-e-monique-nunes/'}]},
  {id:'nome', title:'Por que Etrom?', mark:'Post original', icon:'book', detail:'Etrom é “morte” ao contrário. O Blog Neutro já usava a forma “Ministério Étrom” num post de 09/02/2010 cujo texto fala de ressurreição. A data confirma o uso do nome, não a fundação.', refs:[{label:'Blog Neutro · 09/02/2010',url:'https://luecompania.blogspot.com/2010/02/ministerio-etrom.html'},{label:'Metrópoles · reportagem',url:'https://www.metropoles.com/brasil/ministerio-etrom-a-historia-da-influencer-acusada-de-racismo-e-ameaca'}]},
  {id:'bordoes', title:'Glossário de bordões', mark:'Trechos e imprensa', icon:'quote', detail:'A abertura “Eu, a Menina” aparece numa transcrição do Correio. O Núcleo registra “saymonista” e “de castigo”. Em um post do blog, há repetição de “ATENÇÃO”, data marcada e fecho com “Por Favor”. São recortes públicos, não um retrato de como a pessoa fala fora dos vídeos.', refs:[{label:'Núcleo Jornalismo · referências em vídeo',url:'https://nucleo.jor.br/garimpo/menina-do-ministerio-etrom/'},{label:'Correio Braziliense · trecho transcrito',url:'https://www.correiobraziliense.com.br/cidades-df/2024/04/6848253-menina-do-ministerio-etrom-e-detida-apos-video-ameacando-primeira-dama-do-df.html'}]},
];
export const videos = [
  {label:'Núcleo · recortes e links',url:'https://nucleo.jor.br/garimpo/menina-do-ministerio-etrom/'},
  {label:'R7 · reportagem em vídeo',url:'https://noticias.r7.com/brasilia/balanco-geral-df/video/conheca-a-menina-do-ministerio-etrom-famosa-por-abordar-e-ofender-pessoas-nas-ruas-do-df-14082026/'},
  {label:'Lorelay Fox · vídeo de comentário',url:'https://www.youtube.com/watch?v=uXs_X8o1u14'},
];
export const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
export function classicMatch(text, id) {
  if (id) return classics.find(x=>x.id===id);
  const q = normalize(text);
  const rules = [/(conta|fatura|boleto|plano).*(celular|internet|telefone)|(celular|telefone).*(conta|fatura)/, /coceira|pomada|\banus\b/, /origem|ao contrario|\betro[mn]\b/, /bord(ao|oes)|saymon|castigo|frases/];
  return classics[rules.findIndex(re=>re.test(q))];
}
export function sample(text) {
  const q = normalize(text);
  if (/conta|boleto|fatura/.test(q)) return 'Atenção. A conta foi impressa. Paga ainda não, que são dois acontecimentos diferentes, por favor.';
  if (/oi\b|ola\b|bom dia|boa tarde|boa noite/.test(q)) return 'Oi! Hoje o expediente tá aberto. Me conta: é assunto urgente ou dá pra fazer um café primeiro?';
  if (/me conta|historia/.test(q)) return 'Hoje eu fui comprar um envelope e voltei com um grampeador. O documento continua sem destino, mas muito bem grampeado.';
  return 'Anotado. Só me explica uma coisa: isso é pra resolver hoje ou é pra deixar em cima da mesa até amanhã?';
}
