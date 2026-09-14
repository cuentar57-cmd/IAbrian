const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function todayContext(now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const get=type=>parts.find(p=>p.type===type).value;
  return {date:get("year")+"-"+get("month")+"-"+get("day"),timeZone,now:now.toISOString()};
}
export function isFollowUp(question){
  return question.length<180 && /\b(y |vuelve|volvia|volvera|proxim[oa]|otra vez|despues|ese|esa|entonces|cuando juega)\b/.test(normalize(question));
}
export function teamIn(question){
  const q=question.replace(/[¿?!.]/g," ").trim();
  const match=q.match(/(?:cu[aá]ndo\s+(?:vuelve\s+a\s+)?juega|pr[oó]ximo partido de|fixture de|calendario de)\s+(?:el\s+)?(.+)/i);
  return match?.[1]?.replace(/\s+(hoy|ma[ñn]ana|otra vez|de nuevo).*$/i,"").trim().slice(0,50)||"";
}
export function prepareQuestion(question,history=[],clock=todayContext()){
  const users=history.filter(m=>m.role==="user").slice(-8);
  const explicit=teamIn(question);
  const followUp=!explicit && (isFollowUp(question)||/^(¿?a qu[eé] hora|¿?contra qui[eé]n|¿?en d[oó]nde)/i.test(question));
  const prior=followUp?users.slice(-3).map(m=>m.content).join(" — ").slice(-400):"";
  let previousTeam="";
  for(const message of users){
    const named=teamIn(message.content);
    const short=message.content.match(/^¿?y\s+([\p{L} ]{2,35})[?¿]?$/iu);
    if(named)previousTeam=named;
    else if(previousTeam&&short&&!/despu[eé]s|entonces|cu[aá]ndo|a qu[eé]|contra|vuelve|otra/i.test(short[1]))previousTeam=short[1].trim();
  }
  let team=explicit || (followUp?previousTeam:"");
  const shortTeam=question.match(/^¿?y\s+([\p{L} ]{2,35})[?¿]?$/iu);
  if(shortTeam && team && !/despu[eé]s|entonces|cu[aá]ndo|a qu[eé]|contra|vuelve|otra/i.test(shortTeam[1]))team=shortTeam[1].trim();
  const combined=normalize(prior+" "+question);
  const schedule=!!team && /juega|jugar|partido|fixture|calendario/.test(combined);
  const current=schedule || /\b(hoy|manana|actual|actuales|actualmente|ultimo|ultima|noticias|precio|cotizacion|clima|tiempo en|presidente|resultado|busca|buscame|internet|web)\b/.test(normalize(question));
  return {clock,schedule,team,prior,current,query:schedule?team+" próximo partido fecha horario calendario oficial desde "+clock.date:(prior?prior+" — ":"")+question};
}
const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
export function datesIn(text,year){
  const result=[];
  function add(y,m,d){
    const date=new Date(Date.UTC(+y,+m-1,+d));
    if(date.getUTCFullYear()===+y&&date.getUTCMonth()===+m-1&&date.getUTCDate()===+d)
      result.push(String(y).padStart(4,"0")+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0"));
  }
  for(const m of text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g))add(m[1],m[2],m[3]);
  for(const m of normalize(text).matchAll(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?(20\d{2}))?\b/g))add(m[3]||year,months.indexOf(m[2])+1,m[1]);
  for(const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/g))add(m[3]||year,m[2],m[1]);
  return [...new Set(result)];
}
export const scheduleFallback="No puedo confirmar el próximo partido con las fuentes encontradas. Podés abrir los enlaces y ver los datos publicados debajo.";
export function validateSchedule(answer,sources,clock){
  const dates=datesIn(answer,clock.date.slice(0,4));
  const evidence=sources.flatMap(s=>datesIn(s.title+" "+s.extract,clock.date.slice(0,4)));
  // Same-day fixtures require a verified start time/status, which snippets do not reliably provide.
  if(!dates.length||dates.some(d=>d<=clock.date||!evidence.includes(d)))return scheduleFallback;
  return answer;
}

// Parse calendar rows before asking the small language model to reason about dates.
// Whitespace from search providers may flatten an entire table into one line.
export function fixtureCandidates(sources,context){
  const team=normalize(context.team||teamIn(context.prior||""));
  if(!team)return [];
  const out=[];
  const datePattern=/\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/20\d{2})?|\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?20\d{2})?)\b/gi;
  sources.forEach((s,index)=>{
    const years=[...new Set((s.title+" "+s.extract).match(/\b20\d{2}\b/g)||[])];
    const titleYear=s.title.match(/\b20\d{2}\b/)?.[0];
    const year=titleYear || (years.length===1?years[0]:null);
    const calendar=normalize(s.title).includes(team)&&/calendario|fixture|partidos/.test(normalize(s.title));
    const text=s.extract;
    const tokens=[...normalize(text).matchAll(datePattern)];
    // Accent normalization preserves positions for ordinary Spanish text.
    for(let n=0;n<tokens.length;n++){
      const token=tokens[n];
      if(!year&&!/20\d{2}/.test(token[0]))continue;
      const date=datesIn(token[0],year)[0];
      if(!date||date<context.clock.date)continue;
      const fragment=text.slice(token.index+token[0].length,tokens[n+1]?.index??text.length);
      const times=[...fragment.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)];
      for(let t=0;t<times.length;t++){
        const time=times[t], before=fragment.slice(t?times[t-1].index+times[t-1][0].length:0,time.index);
        const after=fragment.slice(time.index+time[0].length,times[t+1]?.index??fragment.length);
        let opponent="";
        // Team-specific table: date, opponent, home/away, time, venue.
        const table=before.match(/^\s*(?:\|\s*)?([\p{L} .'-]{2,65}?)\s+(?:Local|Visitante)\s*$/iu);
        if(calendar&&table)opponent=table[1].trim();
        // League fixture: time, team – opponent. Stop before the next time/row.
        const row=after.split(/\n|\(|\||[.!?]/)[0].replace(/\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*$/i,"").trim();
        const pair=row.split(/\s+[–—-]\s+|\s+(?:vs\.?|v|contra)\s+/i);
        if(pair.length===2){
          if(normalize(pair[0]).trim()===team)opponent=pair[1].trim();
          else if(normalize(pair[1]).trim()===team)opponent=pair[0].trim();
        }
        if(!opponent||opponent.length>60||!/[\p{L}]/u.test(opponent))continue;
        const argentina=/hora\s*\(ARG\)|hora(?:rio)?\s+(?:de\s+)?argentina|hora argentina/i.test(s.title+" "+text);
        const hour=time[1].padStart(2,"0")+":"+time[2];
        if(date===context.clock.date && (!argentina||!context.clock.now||Date.parse(date+"T"+hour+":00-03:00")<=Date.parse(context.clock.now)))continue;
        out.push({date,time:hour,opponent,index,argentina});
      }
    }
  });
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}
export function calendarAnswer(question,sources,context){
  context={...context,team:context.team||teamIn(question)||teamIn(context.prior||"")};
  const candidates=fixtureCandidates(sources,context);
  if(!candidates.length)return null;
  const a=candidates[0];
  const sameDate=candidates.filter(b=>b.date===a.date);
  if(sameDate.some(b=>normalize(b.opponent)!==normalize(a.opponent)))return null;
  const corroboration=sameDate.find(b=>b.index!==a.index&&new URL(sources[b.index].url).hostname!==new URL(sources[a.index].url).hostname);
  const timed=sameDate.find(b=>b.argentina);
  const [y,m,d]=a.date.split("-");
  const refs=[a.index,...(corroboration?[corroboration.index]:[])].map(i=>"["+(i+1)+"]").join(" ");
  const time=timed?", a las "+timed.time+" (hora de Argentina)":"";
  return "Según "+(corroboration?"los calendarios consultados":"el calendario consultado")+", "+context.team+" juega contra "+a.opponent+" el "+Number(d)+" de "+months[Number(m)-1]+" de "+y+time+". "+refs+
    (timed?"":" El extracto no permite confirmar la hora local.");
}
