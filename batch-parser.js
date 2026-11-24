// Imported HTML is parsed in a detached document; never mounted or executed.
export const questionKey=s=>s.normalize('NFKC').toLowerCase().replace(/[\s\u200b-\u200f\u2060\ufeff]+/g,'');
const clean=s=>s.replace(/[\u200b-\u200f\u2060\ufeff]/g,'').replace(/\r/g,'').trim();
const unescapeText=s=>s.replace(/\\([_\[\]])/g,'$1');
const stripNumber=s=>s.replace(/^\s*(?:#{1,6}\s*)?(?:(?:Question|Beast|妖獸|Q)\s*)?\d+[.．、):：]\s*/i,'');
function documentFor(html,Parser){
 const doc=new Parser().parseFromString(html,'text/html');
 doc.querySelectorAll('script,style,iframe,object,embed,template,noscript,nav').forEach(n=>n.remove());
 return doc;
}
function practiceRows(doc){
 const form=doc.querySelector('#practice-quiz-form');
 if(!form)return null;
 const blocks=[...form.querySelectorAll('.question-block')].filter(n=>!n.closest('[aria-hidden="true"]'));
 if(!blocks.length)return null;
 return blocks.flatMap((block,index)=>{
  const headings=[...block.querySelectorAll('.question-text')];
  const number=headings[0]?.textContent.match(/^\s*(?:Beast|妖獸|Question)\s*(\d+)/i)?.[1]??String(index+1);
  const question=headings.map((n,part)=>{
   let i=0;
   const copy=n.cloneNode(true);
   copy.querySelectorAll('input:not([type]),input[type=text],input[type=number],textarea').forEach(f=>f.replaceWith(doc.createTextNode('[__'+(++i)+'__]')));
   copy.querySelectorAll('br').forEach(b=>b.replaceWith(doc.createTextNode('\n')));
   const value=unescapeText(clean(copy.textContent));
   return part===0?stripNumber(value):value;
  }).filter(Boolean).join('\n');
  const options=[...block.querySelectorAll('label')].flatMap(n=>{
   const m=clean(n.textContent).match(/^([A-H])[.．、)）]\s*([\s\S]+)$/i);
   return m?[{label:m[1].toUpperCase(),text:clean(m[2])}]:[];
  });
  return question?[{question,options,answers:[],number}]:[];
 });
}
export function htmlText(html,Parser=DOMParser,doc=documentFor(html,Parser)){
 doc.querySelectorAll('input:not([type]),input[type=text],input[type=number],textarea').forEach(n=>n.replaceWith(doc.createTextNode('[__1__]')));
 doc.querySelectorAll('.question-text,.question-title,.qtext').forEach(n=>{if(!/^(?:題目|妖獸|Beast|Question|Q\s*\d|\d+[.．、)])/i.test(n.textContent.trim()))n.prepend(doc.createTextNode('題目：'));});
 doc.querySelectorAll('br').forEach(n=>n.replaceWith(doc.createTextNode('\n')));
 doc.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6,section,article,label,pre').forEach(n=>{n.prepend(doc.createTextNode('\n'));n.append(doc.createTextNode('\n'));});
 return clean(doc.body.textContent);
}
export function parseHTML(html,Parser=DOMParser){
 const doc=documentFor(html,Parser);
 const text=htmlText(html,Parser,doc.cloneNode(true)).replace(/\\([_\[\]])/g,'$1').replace(/(?:^|\n)[ \t]*#{1,6}[ \t]+/g,'\n');
 if(/【題組】|\[題組\]/.test(text))throw Error('這份 HTML 包含共用題幹的題組，請先以題組方式整理，避免遺失表格或把不同情境誤認成同題。');
 const practice=practiceRows(doc);if(practice)return practice;
 const marker=/(?:^|\n)\s*(?:Question\b\s*(?:\d+)?\s*[.:：)]?|Q\s*\d+\s*[.:：)]|(?:妖獸|Beast)\s*\d+[.．、:：)]|(?:\d+[.．、]\s*)?題目\s*[：:]|\d+[.．、)](?=\s|[^\d]))\s*/gi;
 const marks=[...text.matchAll(marker)];
 if(!marks.length)return [];
 return marks.map((m,i)=>{
  const block=text.slice(m.index+m[0].length,marks[i+1]?.index??text.length).replace(/\n\s*(終結妖獸|返回心法總覽)[\s\S]*$/,'').trim();
  const labels=[...block.matchAll(/(?:^|\n)\s*(你的答案|正確答案|得分|Your answer|Correct answer|Score)\s*[：:]\s*/gi)];
  const body=block.slice(0,labels[0]?.index??block.length);
  const opts=[...body.matchAll(/(?:^|\n)[ \t]*([A-H])[.．、)）][ \t]*/g)];
  const question=clean(body.slice(0,opts[0]?.index??body.length));
  const options=opts.map((v,j)=>({label:v[1],text:clean(body.slice(v.index+v[0].length,opts[j+1]?.index??body.length))}));
  const a=labels.find(v=>/^(正確答案|Correct answer)$/i.test(v[1]));
  const end=a?labels.find(v=>v.index>a.index):null;
  const answers=a?clean(block.slice(a.index+a[0].length,end?.index??block.length)).split('\n').map(clean).filter(Boolean):[];
  return {question,options,answers};
 }).filter(q=>q.question);
}
// Some text snapshots omit input boxes. Only remove blank placeholders for pairing,
// never numbers, formulas, or option text; ambiguous matches stay unresolved.
const pairKey=s=>questionKey(s.replace(/\[\s*__\d+__\s*\]|\[\d+\]/g,''));
export function combineHTML(questions,answers,existing,subject,unit){
 const known=new Set(existing.filter(q=>(q.subject||'os')===subject&&String(q.unit)===String(unit)).flatMap(q=>[q.question,...(q.aliases||[])].map(questionKey)));
 const seen=new Set();
 return questions.map(q=>{
  const row={question:q.question,options:q.options.map(o=>o.text),answers:[],subject,unit:String(unit)};
  const key=questionKey(q.question);
  if(known.has(key)||seen.has(key))return {...row,status:'duplicate',reason:'同科目、單元已收錄此題（不受選項順序影響）'};
  const matches=answers.filter(a=>pairKey(a.question)===pairKey(q.question));
  if(!matches.length&&q.answers.length)matches.push(q);
  if(!matches.length)return {...row,status:'pending',reason:'找不到相同題目的正確答案'};
  const resolved=matches.map(a=>{
   let values=a.answers;
   if(/^[A-H](?:[\s,，、;；/|]+[A-H])*$/.test(values.join(' '))){
    if(!a.options.length)return null;
    values=values.join(' ').split(/[\s,，、;；/|]+/).map(letter=>a.options.find(o=>o.label===letter)?.text);
   }
   if(!values.length||values.some(v=>!v))return null;
   if(row.options.length){
    values=values.map(v=>row.options.find(o=>questionKey(o)===questionKey(v.replace(/^[A-H][.．、)）]\s*/,''))));
    if(values.some(v=>!v))return null;
   }
   return [...new Set(values)];
  });
  if(resolved.some(a=>!a))return {...row,status:'pending',reason:'答案缺漏或無法對應選項；只有代號時，答案 HTML 必須附選項'};
  if(new Set(resolved.map(a=>JSON.stringify([...a].sort()))).size!==1)return {...row,status:'pending',reason:'答案 HTML 有多個互相衝突的答案，請先確認'};
  row.answers=resolved[0];row.type=row.options.length?(row.answers.length>1?'multiple':'single'):/\[.*?\]|英文回答|格式/.test(row.question)?'fill':'text';
  seen.add(key);return {...row,status:'new',reason:'可新增'};
 });
}

// Lookup normalization only: retain wording, negation, numbers and operators.
export function lookupKey(s){return questionKey(stripNumber(unescapeText(s)).replace(/^(?:題目\s*[：:]\s*)+/,'').replace(/\[\s*__\d+__\s*\]|_{2,}/g,'').replace(/[（(]\s*(?:請用|please answer)[^()（）]*[)）]/gi,'')).replace(/[。．]$/,'');}
