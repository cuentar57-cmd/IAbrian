// Deliberately small Markdown subset. No HTML, embedded images or model-created links.
export function renderMessage(element,text){
  element.replaceChildren();
  const blocks=text.split(/(```[\s\S]*?(?:```|$))/g);
  for(const block of blocks){
    if(!block)continue;
    if(block.startsWith('```')){
      const pre=document.createElement('pre'),code=document.createElement('code');
      code.textContent=block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');pre.append(code);element.append(pre);continue;
    }
    const p=document.createElement('p');
    for(const part of block.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)){
      if(part.startsWith('**')&&part.endsWith('**')){const b=document.createElement('strong');b.textContent=part.slice(2,-2);p.append(b);}
      else if(part.startsWith('`')&&part.endsWith('`')){const code=document.createElement('code');code.textContent=part.slice(1,-1);p.append(code);}
      else p.append(document.createTextNode(part.replace(/^#{1,4} /gm,'')));
    }
    element.append(p);
  }
}
