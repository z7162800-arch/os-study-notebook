'use strict';
const bank=window.QUESTION_BANK;
const subjects={os:'作業系統',algorithm:'演算法'};
let subject=null,unit='all',focusedQuestionId=null;
const requestedQuestionId=new URLSearchParams(window.location.search).get('question');
const subjectOf=q=>q.subject||'os';
const unitOf=q=>q.unit||'unclassified';
function subjectBank(){return bank.filter(q=>subjectOf(q)===subject);}
function unitBank(){return subjectBank().filter(q=>unit==='all'||unitOf(q)===unit);}
const $=s=>document.querySelector(s);
let mode='lookup',practiceQueue=[],practiceIndex=0;
const attempts=new Map();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
function exactMathAnswers(q,text){const parts=text.trim().split(/\r?\n/).filter(v=>v.trim());return parts.length===q.answers.length&&parts.every((v,i)=>v.normalize('NFKC').replace(/\s+/g,'')===q.answers[i].normalize('NFKC').replace(/\s+/g,''));}
const searchKey=s=>s.normalize('NFKC').toLowerCase().replace(/\s+/gu,'');
const questionIdentity=s=>s.normalize('NFKC').toLowerCase().replace(/[\s\u200b-\u200f\u2060\ufeff]+/gu,'');
const questionKind=q=>(q.type==='text'||q.type==='fill'||q.type==='multiple'&&!q.options?.length)?/\[\s*__\d+__\s*\]/u.test(q.question)?'fill':q.answers.length>1?'multiple':'text':q.type;
const choiceOptions=q=>q.options.length?q.options:questionKind(q)==='multiple'?[...new Set(q.answers)]:[];
function filtered(){if(focusedQuestionId)return unitBank().filter(q=>q.id===focusedQuestionId);const tokens=$('#search').value.trim().split(/\s+/).map(searchKey).filter(Boolean);return unitBank().filter(q=>(!$('#category').value||q.group===$('#category').value)&&(!$('#kind').value||($('#kind').value==='set'?!!q.questionSetId:questionKind(q)===$('#kind').value))&&(!tokens.length||[q.question,q.questionSetContext||'',q.questionSetCode||'',...(q.aliases||[])].some(stem=>tokens.every(t=>searchKey(stem).includes(t)))));}
function highlighted(text){const tokens=$('#search').value.trim().split(/\s+/).map(searchKey).filter(Boolean);if(!tokens.length)return esc(text);let lower='';const offsets=[];let index=0;for(const char of text){const start=index;index+=char.length;for(const normalized of char.normalize('NFKC').toLowerCase()){if(!/\s/u.test(normalized)){lower+=normalized;offsets.push([start,index]);}}}const ranges=[];for(const needle of tokens){let at=0;while((at=lower.indexOf(needle,at))!==-1){ranges.push([offsets[at][0],offsets[at+needle.length-1][1]]);at+=needle.length;}}ranges.sort((a,b)=>a[0]-b[0]);const merged=[];for(const r of ranges){const last=merged.at(-1);if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push(r);}let html='',at=0;for(const [start,end] of merged){html+=esc(text.slice(at,start))+'<mark class="search-match">'+esc(text.slice(start,end))+'</mark>';at=end;}return html+esc(text.slice(at));}
function savedTexts(q){return [...new Set(q.aliases||[])].filter(t=>t!==q.question);}
function matchingAlias(q){const tokens=$('#search').value.trim().split(/\s+/).map(searchKey).filter(Boolean);if(!tokens.length||tokens.every(t=>searchKey(q.question).includes(t)))return '';const alias=savedTexts(q).find(stem=>tokens.every(t=>searchKey(stem).includes(t)));return alias?`<p class="muted">也符合題幹：${highlighted(alias)}</p>`:'';}
function questionHeading(q){
 const raw=q.question.replace(/&#(?:xA|10);/gi,'\n').replace(/\\n/g,'\n');
 if(q.subject!=='algorithm')return `<h2>${highlighted(q.question)}</h2>`;
 const renderText=text=>text.trim()?`<p class="question-prompt">${highlighted(text.trim().replace(/\s+(?=(?:做到|執行完後|當 i\s*=|第\d+行|問題\s*\d+：|B陣列的內容為何|C陣列的內容為何|格式:))/g,'\n'))}</p>`:'';
 const renderCode=code=>`<div class="code-label">演算法步驟</div><pre class="question-code"><code>${highlighted(code)}</code></pre>`;
 const heap=/索引\s*i:\s*\(1\)[\s\S]*?陣列位置內容\s*A:\s*\[[^\]]+\]/.exec(raw);
 const heapStart=heap?heap.index+heap[0].length:-1;
 const heapNodes=heap?[...raw.slice(heapStart).matchAll(/(i)?\((\d+)\)\[([^\]]+)\]/g)]:[];
 if(heapNodes.length>=7){
  const end=heapStart+heapNodes.at(-1).index+heapNodes.at(-1)[0].length;
  const nodes=heapNodes.map(m=>({index:Number(m[2]),value:m[3],active:!!m[1]}));
  const levels=[];for(let level=0;2**level<=nodes.length;level++){const row=nodes.filter(n=>n.index>=2**level&&n.index<2**(level+1));if(row.length)levels.push(`<div class="heap-level">${row.map(n=>`<span class="heap-node ${n.active?'heap-active':''}"><small>${n.active?'目前 i · ':''}索引 ${n.index}</small><strong>${esc(n.value)}</strong></span>`).join('')}</div>`);}
  const diagram=`<div class="code-label">目前堆積（由上到下、由左到右）</div><div class="heap-diagram">${levels.join('')}</div>`;
  const prefix=raw.slice(0,heap.index),suffix=raw.slice(end);
  const hasCode=/(?:Build-Max-Heap|Max-Heapify)\s*\([^)]*\)\s+1\s+/i.test(prefix);
  return `<div class="structured-question">${hasCode?questionHeading({...q,question:prefix}):`<h2>${highlighted(prefix.trim())}</h2>`}${diagram}${renderText(suffix)}</div>`;
 }
 const fibonacci=/function\s+fibonacci\s*\(/i.exec(raw);
 if(fibonacci){
  const start=fibonacci.index,open=raw.indexOf('{',start);let depth=0,end=-1;
  for(let i=open;i<raw.length;i++){if(raw[i]==='{')depth++;else if(raw[i]==='}'&&!--depth){end=i+1;break;}}
  if(end>open){let code=raw.slice(start,end).trim();if(!code.includes('\n')){
   const conditions=[...code.matchAll(/(?:if|else if)\s*\((\[__\d+__\])\)/g)].map(x=>x[1]);
   if(conditions.length===2)code=`function fibonacci(n) {\n    if (${conditions[0]}) {\n        return 0;\n    } else if (${conditions[1]}) {\n        return 1;\n    }\n\n    int prev2 = 0;\n    int prev1 = 1;\n    int current = 0;\n\n    for (int i = 2; i <= n; i++) {\n        current = prev1 + prev2;\n        prev2 = prev1;\n        prev1 = current;\n    }\n\n    return current;\n}`;
  }return `<div class="structured-question">${renderText(raw.slice(0,start))}${renderCode(code)}${renderText(raw.slice(end))}</div>`;}
 }
 const signature=/(?:COUNTING_SORT|BUCKET_SORT|RADIX_SORT|Insertion-Sort|Build-Max-Heap|Max-Heapify|PARTITION|RANDOMIZED_SELECT|GET_MIN_MAX)\s*\([^\n)]*\)\s+(?=1\s+)/gi;
 const matches=[...raw.matchAll(signature)];
 if(!matches.length)return `<h2>${highlighted(raw)}</h2>`;
 let html='<div class="structured-question">',cursor=0;
 for(const match of matches){
  const start=match.index,bodyStart=start+match[0].length;
  const next=matches.find(item=>item.index>start);
  let end=next?next.index:raw.length;
  const tail=/(?:\s+(?:A陣列的內容為|索引\s*i:|以上\s*(?:為|是)|關於虛擬碼|若改為|第\d+與\d+行要怎麼改))/g;
  const boundary=tail.exec(raw.slice(bodyStart,end));
  if(boundary)end=bodyStart+boundary.index;
  const before=raw.slice(cursor,start);
  if(before.trim())html+=cursor===0?`<h2>${highlighted(before.trim())}</h2>`:renderText(before);
  let code=match[0].trim()+'\n'+raw.slice(bodyStart,end).trim();
  let expected=2;
  code=code.replace(/\s+(\d{1,2})(?=\s+(?:for|do|then|else|elseif|if|while|return|exchange|concatenate|\/\/|>|[A-Za-z_]+\[[^\n]{1,24}\]\s*(?:←|<-|=)|[A-Za-z_]+\s*(?:←|<-|=)|_{3,}|\[__|\d{1,2}(?:\s|$)|$))/g,(whole,number)=>Number(number)===expected?(expected++,`\n${number}  `):whole);
  code=code.replace(/\n1\s+/,'\n1  ');
  code=code.replace(/\n{3,}/g,'\n\n');
  html+=renderCode(code);
  cursor=end;
 }
 html+=renderText(raw.slice(cursor));
 return html+'</div>';
}
function coverage(){const rows=unitBank();$('#coverage').textContent=`本範圍共 ${rows.length} 題。中文、英文及不同題幹分開收錄，可各自搜尋與練習。`;}
function answer(q){return `<div class="answer"><strong>正確答案${q.note?' · 請留意下方提醒':''}</strong>${q.answers.length>1?'<ul>'+q.answers.map(a=>`<li>${esc(a)}</li>`).join('')+'</ul>':`<p>${esc(q.answers[0])}</p>`}</div>`;}
function pendingCard(q){
 const versions=q.variants?.map((v,i)=>`<div class="note"><strong>版本 ${i+1}</strong><ul>${v.options.map(o=>`<li class="${v.answers.includes(o)?'correct':''}">${v.answers.includes(o)?'✓ ':'• '}${esc(o)}</li>`).join('')}</ul></div>`).join('')||'';
 return `<article class="card pending" data-id="${q.id}"><div class="meta"><span>${q.id.toUpperCase()}</span><span class="tag">${q.variants?'複選 · 答案待核對':'待補選項'}</span><span>${esc(q.group)}</span></div>${questionHeading(q)}${matchingAlias(q)}<div class="pending-message"><strong>${q.variants?'不同版本的答案':'答案文字待確認'}</strong><p>${esc(q.resultRecord)}</p>${versions||'<p>請提供本題的完整選項，才能補上確定答案。此題暫不計入作答。</p>'}</div><details><summary>觀念提示</summary><p>${esc(window.explainQuestion(q))}</p></details></article>`;
}
function questionSetStart(q,previous){if(!q.questionSetId||previous?.questionSetId===q.questionSetId)return '';return `<section class="question-set" aria-label="${esc(q.questionSetTitle||'題組')}"><header class="question-set-header"><span class="tag">題組</span><h2>${esc(q.questionSetTitle||'共用題幹')}</h2><p>${esc(q.questionSetContext||'')}</p>${q.questionSetCode?`<pre class="question-code"><code>${esc(q.questionSetCode)}</code></pre>`:''}</header>`;}
function questionSetEnd(q,next){return q.questionSetId&&next?.questionSetId!==q.questionSetId?'</section>':'';}
function render(){coverage();const data=mode==='practice'?(practiceQueue[practiceIndex]?[practiceQueue[practiceIndex]]:[]):filtered();updatePractice();$('#count').textContent=`找到 ${data.length} 題 / 共 ${unitBank().length} 題`;$('#help').textContent=mode==='lookup'?'輸入題目片段，即可查看綠框答案。點「解析」看原因。':'選擇選項或輸入答案後核對。缺少完整選項的題目，請對照答案自行確認。';$('#results').innerHTML=data.length?data.map((q,index)=>{const setStart=questionSetStart(q,data[index-1]),setEnd=questionSetEnd(q,data[index+1]);if(q.pending)return setStart+pendingCard(q)+setEnd;const a=attempts.get(q.id)||{};const revealed=mode==='lookup'||a.revealed;const choices=choiceOptions(q);let body=q.code?`<pre class="question-code"><code>${esc(q.code)}</code></pre>`:'';if(!q.options.length&&choices.length)body+='<p class="muted">目前只有已知的正確選項；原試卷其他選項未收錄，可勾選作答。</p>';if(q.optionsIncomplete)body+='<p class="muted">僅列已知選項；編號不是原試卷順序，未提供的選項不補造。</p>';if(choices.length){body+='<div class="options">'+choices.map((o,i)=>{const correct=q.answers.includes(o);const selected=(a.selected||[]).includes(i);return `<${mode==='practice'?'label':'div'} class="option ${revealed&&correct?'correct':''} ${mode==='practice'&&selected?(revealed&&!correct?'wrong':'selected'):''}">${mode==='practice'?`<input type="${questionKind(q)==='multiple'?'checkbox':'radio'}" name="${q.id}" data-index="${i}" ${selected?'checked':''} ${a.revealed?'disabled':''}>`:''}<span class="letter">${q.subject==='algorithm'?String(i+1):String.fromCharCode(65+i)}.</span><span>${esc(o)}</span>${revealed&&correct?'<span class="answer-mark">✓ 正確</span>':''}</${mode==='practice'?'label':'div'}>`}).join('')+'</div>';}else if(mode==='practice'&&!q.imageUnavailable){body+=`<div class="entry"><label for="input-${q.id}">${q.ordered?'依空格順序作答（每行一個答案）':q.answers.length>1?'原試卷選項未收錄，請寫出所有答案（每行一項）':'輸入你的答案'}</label><textarea id="input-${q.id}" placeholder="在這裡作答…" ${a.revealed?'readonly':''}>${esc(a.text||'')}</textarea></div><p class="muted">${q.mathExact?'依空格順序，每行填一格；保留大小寫、括號及運算符號。':q.ordered?'依空格順序，每行填一格。':q.answers.length>1?'原始完整選項未提供，核對後請自行確認。':'接受大小寫與一般空白差異；句意相同可自行確認。'}</p>`;}if(revealed&&(!choices.length||q.subject==='algorithm'))body+=answer(q);if(revealed&&q.previousAnswers?.length)body+=`<div class="note"><strong>較早收錄的答案（與本次匯出不同）</strong><ul>${q.previousAnswers.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div>`;if(revealed&&q.officialAnswers?.length)body+=`<div class="note"><strong>題庫原標準答案（含爭議項）</strong><ul>${q.officialAnswers.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div>`;if(mode==='practice'&&!q.imageUnavailable){body+=`<div class="actions">${!a.revealed?'<button class="primary" data-action="check">核對答案</button><button data-action="reveal">先看答案</button>':`${!choices.length?'<button data-action="yes">我答對了</button><button data-action="no">還要練習</button>':''}<button data-action="retry">再答一次</button><button class="primary" data-action="next">下一題</button>`}</div>`;}if(mode==='practice'&&a.feedback)body+=`<div class="feedback ${a.correct===false?'error':''}" role="status">${esc(a.feedback)}</div>`;if(q.imageUnavailable&&!revealed)body+='<p class="muted">原圖缺少，請切換「搜尋查答案」查看已知答案。</p>';if(revealed){if(q.basis)body+=`<p class="muted">${esc(q.basis)}</p>`;if(q.note)body+=`<div class="note">${esc(q.note)}</div>`;body+=`<details ${mode==='practice'?'open':''}><summary>${window.explainKind(q)==='topic'?'觀念提示・逐題解析待補':window.explainKind(q)==='answer'?'答案說明':'逐題解析'}</summary><p>${esc(window.explainQuestion(q))}</p>${q.sources?.length?'<p class="sources">參考：'+q.sources.map(v=>`<a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.label)}</a>`).join(' · ')+'</p>':''}</details>`;}return setStart+`<article class="card" data-id="${q.id}"><div class="meta">${q.questionSetId?`<span class="set-index">第 ${esc(q.questionSetIndex||1)} 題</span>`:''}<span>${q.id.toUpperCase()}</span><span class="tag">${questionKind(q)==='multiple'?(q.options.length?'多選':'多選 · 已知選項'):questionKind(q)==='single'?'單選':questionKind(q)==='fill'?'填空題':questionKind(q)==='pending'?'待補選項':q.answers.length>1?'文字多項':'文字作答'}</span><span>${esc(q.group)}</span>${q.note?'<span>有補充提醒</span>':''}</div>${questionHeading(q)}${matchingAlias(q)}${body}</article>`+setEnd}).join(''):(mode==='practice'?'<div class="empty"><strong>這輪練習完成了</strong><p>可以再隨機練習一輪，或按退出回到題庫。</p><button id="restart-practice">再練一輪</button></div>':unitBank().length?'<div class="empty"><strong>沒有找到符合的題目</strong><p>試試較短的關鍵字，例如「核心」或「read」。<br>也可以清除題型與主題篩選。</p><button id="resetfilters">清除所有篩選</button></div>':'<div class="empty"><strong>這個單元尚未加入題目</strong><p>傳題庫時只要註明科目和第幾單元，不需要單元名稱。<br>例如：作業系統｜第 1 單元</p></div>');updateStats();}
function updateStats(){const done=unitBank().map(q=>attempts.get(q.id)).filter(a=>a&&typeof a.correct==='boolean');$('#done').textContent=done.length;$('#score').textContent=done.length?`${done.filter(a=>a.correct).length} 題答對 · ${done.filter(a=>!a.correct).length} 題待複習`:'開始作答，逐題確認觀念。';}
function shuffleQuestions(rows){const blocks=[],groups=new Map();for(const q of rows){if(!q.questionSetId){blocks.push([q]);continue;}let group=groups.get(q.questionSetId);if(!group){group=[];groups.set(q.questionSetId,group);blocks.push(group);}group.push(q);}for(const group of groups.values())group.sort((a,b)=>(a.questionSetIndex||0)-(b.questionSetIndex||0));for(let i=blocks.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[blocks[i],blocks[j]]=[blocks[j],blocks[i]];}return blocks.flat();}
function startPractice(){practiceQueue=shuffleQuestions(unitBank().filter(q=>!q.pending&&!q.imageUnavailable));practiceIndex=0;for(const q of practiceQueue)attempts.delete(q.id);setMode('practice');window.scrollTo(0,0);}
function updatePractice(){const practicing=mode==='practice';document.body.classList.toggle('is-practicing',practicing);$('#practice-screen').hidden=!practicing;$('#practice-scope').textContent=`${subjects[subject]||''} · ${unit==='all'?'全部單元':`第 ${unit} 單元`}`;const done=practiceQueue.map(q=>attempts.get(q.id)).filter(a=>a?.revealed).length;$('#practice-progress').textContent=practiceQueue.length?`${Math.min(practiceIndex+1,practiceQueue.length)} / ${practiceQueue.length} 題 · 已核對 ${done} 題`:'這個單元尚無可練習題目';}
function setMode(next){mode=next;for(const id of ['lookup','practice']){$('#'+id).classList.toggle('active',id===mode);$('#'+id).setAttribute('aria-pressed',String(id===mode));}render();}
$('#practice').onclick=startPractice;$('#lookup').onclick=()=>setMode('lookup');$('#exit-practice').onclick=()=>{setMode('lookup');window.scrollTo(0,0);};
function resumeLookup(){focusedQuestionId=null;render();}
$('#search').addEventListener('input',resumeLookup);for(const id of ['category','kind'])$('#'+id).onchange=resumeLookup;
$('#clear').onclick=()=>{$('#search').value='';resumeLookup();$('#search').focus();};
$('#results').addEventListener('input',e=>{const card=e.target.closest('[data-id]');if(!card)return;const a=attempts.get(card.dataset.id)||{};if(e.target.tagName==='TEXTAREA')a.text=e.target.value;else if(e.target.matches('input'))a.selected=[...card.querySelectorAll('input:checked')].map(i=>Number(i.dataset.index));attempts.set(card.dataset.id,a);});
$('#results').addEventListener('click',e=>{if(e.target.id==='restart-practice'){startPractice();return;}if(e.target.closest('[data-action="next"]')){practiceIndex++;render();window.scrollTo(0,0);return;}if(e.target.id==='resetfilters'){$('#search').value='';$('#category').value='';$('#kind').value='';render();return;}const btn=e.target.closest('[data-action]');if(!btn)return;const id=btn.closest('[data-id]').dataset.id;const q=bank.find(q=>q.id===id);const a=attempts.get(id)||{};const action=btn.dataset.action;const before=btn.closest('[data-id]').getBoundingClientRect().top;if(action==='retry'){attempts.delete(id);}else{if(action==='check'){const choices=choiceOptions(q);if(choices.length){const selected=(a.selected||[]).map(i=>choices[i]);if(!selected.length){a.feedback='請先選擇答案。';attempts.set(id,a);render();return;}a.correct=selected.length===q.answers.length&&q.answers.every(v=>selected.includes(v));a.feedback=a.correct?'答對了！':'再看一次綠框答案，留意漏選或多選。';}else{if(!(a.text||'').trim()){a.feedback='請先輸入答案，或按「先看答案」。';attempts.set(id,a);render();return;}if(q.mathExact?exactMathAnswers(q,a.text):((q.answers.length===1&&(q.acceptedAnswers||q.answers).some(v=>normalize(a.text)===normalize(v)))||(q.ordered&&[q.answers,...(q.acceptedAnswerSets||[])].some(values=>normalize(a.text)===normalize(values.join(' ')))))){a.correct=true;a.feedback='答對了！';}else{if(q.mathExact){a.correct=false;a.feedback='請對照各格答案，檢查大小寫、運算符號與填空順序。';}else{a.feedback='請對照標準答案，確認你的答案是否相同。';}}}a.revealed=true;}if(action==='reveal'){a.revealed=true;a.feedback='先理解答案，再按「再答一次」練習。';}if(action==='yes'||action==='no'){a.correct=action==='yes';a.feedback=a.correct?'已記錄：答對了。':'已記錄：還要練習。';}attempts.set(id,a);}render();const after=document.querySelector(`[data-id="${id}"]`);if(after)window.scrollBy(0,after.getBoundingClientRect().top-before);});
function selectUnit(next){focusedQuestionId=null;unit=next;renderUnits();$('#search').value='';$('#category').value='';$('#kind').value='';render();}
function renderUnits(){const rows=subjectBank();const units=[...new Set([...(subject==='os'?['1','2','3','4','5','6']:[]),...rows.map(unitOf)])].sort((a,b)=>{if(a==='unclassified')return 1;if(b==='unclassified')return -1;const na=Number(a),nb=Number(b);if(Number.isFinite(na)&&Number.isFinite(nb))return na-nb;return String(a).localeCompare(String(b),'zh-Hant',{numeric:true});});const labels=id=>id==='unclassified'?'尚未分類':(rows.find(q=>unitOf(q)===id)?.unitName||`第 ${id} 單元`);$('#unit-list').innerHTML=[['all','全部單元',rows.length],...units.map(id=>[id,labels(id),rows.filter(q=>unitOf(q)===id).length])].map(([id,label,count])=>`<button data-unit="${esc(id)}" class="unit-button ${unit===id?'active':''}" aria-pressed="${unit===id}"><span>${esc(label)}</span><span>${count} 題</span></button>`).join('');$('#unit-title').textContent=unit==='all'?'全部單元':labels(unit);}
function openSubject(next,initialUnit='all',questionId=null){focusedQuestionId=questionId;mode='lookup';document.body.classList.remove("is-home");subject=next;unit=initialUnit;$('#home').hidden=true;$('#study').hidden=false;$('#home-button').hidden=false;$('#subject-title').textContent=subjects[subject];$('#search').value='';$('#kind').value='';$('#category').innerHTML='<option value="">所有主題</option>'+[...new Set(subjectBank().map(q=>q.group))].map(g=>`<option>${esc(g)}</option>`).join('');$('#search').placeholder=subject==='os'?'例如：微核心、read、ROM…':'搜尋演算法題目或關鍵字';renderUnits();render();window.scrollTo(0,0);}
for(const button of document.querySelectorAll('[data-subject]'))button.onclick=()=>openSubject(button.dataset.subject);
$('#unit-list').onclick=e=>{const b=e.target.closest('[data-unit]');if(b)selectUnit(b.dataset.unit);};
$('#home-button').onclick=()=>{document.body.classList.add('is-home');$('#study').hidden=true;$('#home').hidden=false;$('#home-button').hidden=true;subject=null;window.scrollTo(0,0);};
for(const key of Object.keys(subjects)){const count=bank.filter(q=>subjectOf(q)===key).length;$('#'+key+'-total').textContent=count?`${count} 題 · 選擇單元開始學習`:'尚未加入題庫';}
if(document.modelContext?.registerTool){const life=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'search_os_questions',title:'搜尋作業系統題庫',description:'搜尋題庫並更新頁面上的搜尋結果。',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input.query!=='string')throw Error('query must be a string');if(!subject)openSubject('os');$('#search').value=input.query;resumeLookup();return filtered().map(q=>({id:q.id,question:q.question}));}},{signal:life.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>life.abort(),{once:true});}

const motionToggle=document.querySelector("#motion-toggle");motionToggle.onclick=()=>{const paused=document.body.classList.toggle("motion-paused");motionToggle.textContent=paused?"播放動畫":"暫停動畫";motionToggle.setAttribute("aria-pressed",String(paused));};

function refreshTotals(){for(const key of Object.keys(subjects))$('#'+key+'-total').textContent=`${bank.filter(q=>subjectOf(q)===key).length} 題 · 選擇單元開始學習`;if(subject){const selected=$('#category').value;$('#category').innerHTML='<option value="">所有主題</option>'+[...new Set(subjectBank().map(q=>q.group))].map(g=>`<option>${esc(g)}</option>`).join('');$('#category').value=selected;renderUnits();render();}}
async function loadShared(){try{const response=await window.localQuestionBank.load();const data=await response.json();if(!response.ok)throw Error(data.error);for(const q of data.questions){const index=bank.findIndex(v=>v.id===q.id);if(index>=0){bank[index]=q;continue;}const match=bank.findIndex(v=>subjectOf(v)===subjectOf(q)&&String(unitOf(v))===String(unitOf(q))&&[v.question,...(v.aliases||[])].some(stem=>questionIdentity(stem)===questionIdentity(q.question)));if(match>=0){if(bank[match].catalogRevision)bank[match]=q;else if(q.id===requestedQuestionId)bank.push(q);}else bank.push(q);}for(const q of data.overrides||[]){const index=bank.findIndex(v=>v.id===q.id);if(index>=0)bank[index]=q;}$('#shared-status').textContent='';refreshTotals();return true;}catch(e){$('#shared-status').textContent='目前瀏覽器儲存的題目暫時無法載入。';return false;}}
async function openRequestedQuestion(){
 const loaded=await loadShared();
 if(!requestedQuestionId)return;
 const q=bank.find(row=>row.id===requestedQuestionId);
 if(!q){
  const notice=document.createElement('p');notice.setAttribute('role','status');
  notice.textContent=loaded?'找不到這道題目，請回到批次查題重新比對。':'暫時無法載入這道題目，請重新整理或稍後再試。';
  $('#home').prepend(notice);return;
 }
 openSubject(subjectOf(q),unitOf(q),q.id);
 const card=$('#results [data-id]');
 if(card){card.tabIndex=-1;card.focus({preventScroll:true});card.scrollIntoView({block:'start'});}
}
openRequestedQuestion();
