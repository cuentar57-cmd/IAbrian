import test from "node:test";
import assert from "node:assert/strict";
import {calendarAnswer,prepareQuestion,validateSchedule,datesIn} from "../answer-context.js";
const clock={date:"2026-09-13",timeZone:"America/Argentina/Buenos_Aires"};
const sources=[
 {title:"River calendario septiembre 2026",url:"https://example.org/calendar",extract:"Sábado 12/9 Atlético Tucumán Visitante 17:30\nSábado 19/9 Huracán Local 19:00"},
 {title:"Fixture 2026",url:"https://example.net/fixture",extract:"Sábado 19 de septiembre\n14.30 Gimnasia – Banfield\n19.00 River – Huracán"}
];
test("abbreviated date is interpreted with provided year",()=>assert.deepEqual(datesIn("Sábado 19/9",2026),["2026-09-19"]));
test("two agreeing calendars answer directly and exclude yesterday",()=>{
 const c=prepareQuestion("Cuando juega River",[],clock);
 const answer=calendarAnswer("Cuando juega River",sources,c);
 assert.match(answer,/19 de septiembre de 2026/);assert.match(answer,/Huracán/);
 assert.doesNotMatch(answer,/12\/9/);
 assert.equal(validateSchedule(answer,sources,clock),answer);
});
test("one source or conflicting opponents cannot directly confirm match",()=>{
 const c=prepareQuestion("Cuando juega River",[],clock);
 assert.equal(calendarAnswer("Cuando juega River",sources.slice(0,1),c),null);
 assert.equal(calendarAnswer("Cuando juega River",[sources[0],{...sources[1],extract:"Sábado 19 de septiembre\n19.00 River – Lanús"}],c),null);
});
test("missing year or two pages of same domain cannot confirm match",()=>{
 const c=prepareQuestion("Cuando juega River",[],clock);
 assert.equal(calendarAnswer("Cuando juega River",sources.map(s=>({...s,title:s.title.replace("2026","")})),c),null);
 assert.equal(calendarAnswer("Cuando juega River",[sources[0],{...sources[1],url:"https://example.org/other"}],c),null);
});
