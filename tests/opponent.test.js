import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareQuestion,calendarAnswer} from '../answer-context.js';
const clock={date:'2026-09-13',timeZone:'UTC'};
const history=[{role:'user',content:'Cuando juega River'}];
// Synthetic fixtures, not claims about the real sporting calendar.
const sources=[{title:'River calendario 2026',url:'https://example.org',extract:'Hora (ARG) 19/9 Huracán Local 19:00 30/9 Boca Juniors Local 20:00'}];
for(const question of ['Y contra boca cuando juega','Cuando juega River contra Boca','Cuando juega River vs Boca']){
  test('keeps team and opponent separate: '+question,()=>{
    const context=prepareQuestion(question,history,clock);
    assert.equal(context.team,'River');assert.equal(context.opponent.toLowerCase(),'boca');
    assert.match(context.query,/River contra [Bb]oca/);
    const answer=calendarAnswer(question,sources,context);
    assert.match(answer,/Boca Juniors el 30 de septiembre/);assert.doesNotMatch(answer,/Huracán/);
  });
}
test('does not replace requested opponent with the next unrelated fixture',()=>{
  const c=prepareQuestion('Y contra boca cuando juega',history,clock);
  assert.equal(calendarAnswer('',[{...sources[0],extract:'19/9 Huracán Local 19:00'}],c),null);
});
test('retains requested opponent in a subsequent time followup',()=>{
  const c=prepareQuestion('¿A qué hora?',[...history,{role:'user',content:'Y contra boca cuando juega'}],clock);
  assert.equal(c.team,'River');assert.equal(c.opponent,'boca');
});
test('an explicit new team clears the old opponent',()=>{
  const c=prepareQuestion('Cuando juega Racing',[...history,{role:'user',content:'Y contra Boca cuando juega'}],clock);
  assert.equal(c.team,'Racing');assert.equal(c.opponent,'');
});
