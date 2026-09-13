import test from "node:test";
import assert from "node:assert/strict";
import {todayContext,prepareQuestion,validateSchedule,scheduleFallback,datesIn} from "../answer-context.js";
import {webMessages} from "../web-search.js";
const clock={date:"2026-09-13",timeZone:"America/Argentina/Buenos_Aires"};
test("River follow-up preserves topic without trusting an earlier assistant answer",()=>{
 const c=prepareQuestion("¿Cuándo volvía a jugar?",[{role:"user",content:"¿Cuándo juega River?"},{role:"assistant",content:"El 12 de septiembre"}],clock);
 assert.equal(c.schedule,true);assert.match(c.query,/River/);assert.match(c.query,/2026-09-13/);assert.doesNotMatch(c.query,/12 de septiembre/);
});
test("local date respects timezone near midnight and year boundary",()=>{
 assert.equal(todayContext(new Date("2027-01-01T01:00:00Z"),clock.timeZone).date,"2026-12-31");
});
test("yesterday cannot be offered as next match even if a result contains it",()=>{
 assert.equal(validateSchedule("Juega el 12 de septiembre de 2026",[{title:"River",extract:"12 de septiembre de 2026"}],clock),scheduleFallback);
});
test("future date must appear in evidence; unknown dates cannot pass",()=>{
 assert.equal(validateSchedule("Juega el 20 de septiembre de 2026",[{title:"River",extract:"12 de septiembre de 2026"}],clock),scheduleFallback);
 assert.equal(validateSchedule("Juega mañana",[],clock),scheduleFallback);
 assert.equal(validateSchedule("Juega el 13 de septiembre",[{title:"River",extract:"13 de septiembre"}],clock),scheduleFallback);
});
test("supported future date passes conservative date check",()=>{
 const answer="El 20 de septiembre de 2026 [1].";
 assert.equal(validateSchedule(answer,[{title:"Calendario",extract:"20 de septiembre de 2026"}],clock),answer);
});
test("invalid dates rejected and year rollover preserved",()=>{
 assert.deepEqual(datesIn("31 de febrero de 2026",2026),[]);
 assert.deepEqual(datesIn("2 de enero de 2027",2026),["2027-01-02"]);
});
test("sports prompt includes local date and preceding user topic within context budget",()=>{
 const c=prepareQuestion("¿Cuándo vuelve a jugar?",[{role:"user",content:"¿Cuándo juega River?"}],clock);
 const m=webMessages("x".repeat(2200),[{title:"a".repeat(200),url:"https://example.org",extract:"a".repeat(1000)},{title:"b",url:"https://example.net",extract:"b".repeat(1000)}],c);
 assert.match(m[0].content,/2026-09-13/);assert.match(m[1].content,/River/);
 assert.ok(new TextEncoder().encode(m.map(x=>x.content).join("")).length<3900);
});
