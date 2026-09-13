const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function todayContext(now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const get=type=>parts.find(p=>p.type===type).value;
  return {date:get("year")+"-"+get("month")+"-"+get("day"),timeZone};
}
export function isFollowUp(question){
  return question.length<180 && /\b(y |vuelve|volvia|volvera|proxim[oa]|otra vez|despues|ese|esa|entonces|cuando juega)\b/.test(normalize(question));
}
export function prepareQuestion(question,history=[],clock=todayContext()){
  const previous=[...history].reverse().find(m=>m.role==="user")?.content||"";
  const followUp=isFollowUp(question);
  // Only the preceding user question is used; assistant answers may contain mistakes.
  const prior=followUp?previous.slice(0,180):"";
  const combined=prior+" "+question;
  const schedule=/\b(juega|jugar|partido|fixture|vuelve|volvia|volvera)\b/.test(normalize(combined)) &&
    /\b(cuando|proxim[oa]|vuelve|volvia|volvera|hoy|manana)\b/.test(normalize(combined));
  return {clock,schedule,prior,query:(prior?prior+" — ":"")+question+(schedule?" próximo partido fecha horario calendario oficial desde "+clock.date:"")};
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
  for(const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g))add(m[3],m[2],m[1]);
  return [...new Set(result)];
}
export const scheduleFallback="No puedo confirmar el próximo partido con las fuentes encontradas. Revisá el calendario oficial del equipo en los enlaces de abajo. No voy a darte una fecha pasada como si fuera el próximo encuentro.";
export function validateSchedule(answer,sources,clock){
  const dates=datesIn(answer,clock.date.slice(0,4));
  const evidence=sources.flatMap(s=>datesIn(s.title+" "+s.extract,clock.date.slice(0,4)));
  // Same-day fixtures require a verified start time/status, which snippets do not reliably provide.
  if(!dates.length||dates.some(d=>d<=clock.date||!evidence.includes(d)))return scheduleFallback;
  return answer;
}
