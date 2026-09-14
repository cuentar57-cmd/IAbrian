import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareQuestion,calendarAnswer,fixtureCandidates} from '../answer-context.js';
import {cleanSources,webMessages} from '../web-search.js';
const clock={date:'2026-09-14',timeZone:'America/Argentina/Buenos_Aires'};
const table={title:'River en septiembre 2026: calendario, partidos y horarios',url:'https://example.org/calendario',extract:'FechaRivalCondiciónHora (ARG)Estadio Domingo 6/9 Independiente Rivadavia Local 19:15 Más Monumental Sábado 12/9 Atlético Tucumán Visitante 17:30 Monumental José Fierro Sábado 19/9 Huracán Local 19:00 Más Monumental'};
const fixture={title:'Fixture Clausura 2026',url:'https://example.net/fixture',extract:'Sábado 19 de septiembre 14.30 Gimnasia – Banfield (Zona B) 19.00 River – Huracán (Zona B) 21.15 Instituto – Talleres (Zona A)'};
test('flattened multirow table gives one short future answer with opponent and Argentine time',()=>{
 const answer=calendarAnswer('¿Cuándo juega River?',[table,fixture],prepareQuestion('¿Cuándo juega River?',[],clock));
 assert.match(answer,/Huracán el 19 de septiembre de 2026, a las 19:00 \(hora de Argentina\)/);
 assert.match(answer,/\[1\] \[2\]/);assert.ok(answer.length<220);assert.doesNotMatch(answer,/12\/9|Tucumán/);
});
test('preserves fixture evidence beyond the old 500 byte cutoff',()=>{
 const long={...table,extract:'Introducción. '.repeat(100)+table.extract};
 const safe=cleanSources([long,fixture]);assert.match(safe[0].extract,/Huracán/);
 assert.match(calendarAnswer('Cuando juega River',safe,prepareQuestion('Cuando juega River',[],clock)),/19 de septiembre/);
});
test('context survives several followups and an explicit change of team',()=>{
 const h=[{role:'user',content:'Cuando juega River'},{role:'user',content:'¿a qué hora?'},{role:'user',content:'¿Y Boca?'}];
 assert.equal(prepareQuestion('¿Contra quién?',h,clock).team,'Boca');
 const c=prepareQuestion('Cuando juega Racing',h,clock);assert.equal(c.team,'Racing');assert.doesNotMatch(c.query,/River|Boca/);
});
test('unknown timezone is not silently labelled Argentina',()=>{
 const c=prepareQuestion('Cuando juega River',[],clock);
 assert.match(calendarAnswer('Cuando juega River',[fixture],c),/no permite confirmar la hora local/);
});
test('generic team-specific calendars work without River-specific data',()=>{
 const s={...table,title:'Boca calendario 2026',extract:'Hora (ARG) Sábado 19/9 Lanús Local 21:00'};
 assert.match(calendarAnswer('Cuando juega Boca',[s],prepareQuestion('Cuando juega Boca',[],clock)),/Boca juega contra Lanús/);
});
test('past and same-day rows without live status are not offered as upcoming',()=>{
 const c=prepareQuestion('Cuando juega River',[],clock);
 assert.deepEqual(fixtureCandidates([{...table,extract:'12/9 Huracán Local 19:00 14/9 Lanús Local 21:00'}],c),[]);
});
test('invalid calendar dates do not turn into real fixtures',()=>{
 assert.equal(calendarAnswer('Cuando juega River',[{...table,extract:'31/9 Huracán Local 19:00'}],prepareQuestion('Cuando juega River',[],clock)),null);
});
test('five large sources and unicode question fit the local prompt budget',()=>{
 const docs=Array.from({length:5},(_,i)=>({...table,url:'https://example.org/'+i,extract:'☀️ mundo '.repeat(1800)}));
 const prompt=webMessages('☀️'.repeat(1000),docs,prepareQuestion('Cuando juega River',[],clock));
 assert.ok(new TextEncoder().encode(prompt.map(m=>m.content).join('')).length<3900);
});
test('same-day Argentine kickoff is offered only before its verified time',()=>{
 const s={...table,extract:'Hora (ARG) 14/9 Huracán Local 19:00'};
 const before={...clock,now:'2026-09-14T20:00:00Z'},after={...clock,now:'2026-09-14T23:00:00Z'};
 assert.match(calendarAnswer('Cuando juega River',[s],prepareQuestion('Cuando juega River',[],before)),/14 de septiembre/);
 assert.equal(calendarAnswer('Cuando juega River',[s],prepareQuestion('Cuando juega River',[],after)),null);
});
