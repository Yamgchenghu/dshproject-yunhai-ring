/* ===== Python 风格脚本：词法 / 语法 / 异步解释器 ===== */
'use strict';

function pyTokenize(src){
  const out = [];
  let i = 0;
  const two = ['==','!=','<=','>=','//','**','+=','-=','*=','/=','%='];
  while (i < src.length){
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n'){ i++; continue; }
    if (c === '#') break;
    if (c === '"' || c === "'"){
      const q = c; i++;
      let s = '';
      while (i < src.length){
        const d = src[i++];
        if (d === q) break;
        if (d === '\\'){
          const e = src[i++];
          s += (e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e);
        } else s += d;
      }
      out.push({ t:'str', v:s });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i+1] || ''))){
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      if (j < src.length && (src[j] === 'e' || src[j] === 'E')){
        let k = j + 1;
        if (k < src.length && (src[k] === '+' || src[k] === '-')) k++;
        const d0 = k;
        while (k < src.length && /[0-9]/.test(src[k])) k++;
        if (k > d0) j = k;
      }
      out.push({ t:'num', v: Number(src.slice(i, j)) });
      i = j; continue;
    }
    if (/[A-Za-z_\u4e00-\u9fff]/.test(c)){
      let j = i;
      while (j < src.length && /[A-Za-z0-9_\u4e00-\u9fff]/.test(src[j])) j++;
      out.push({ t:'name', v: src.slice(i, j) });
      i = j; continue;
    }
    const p2 = src.slice(i, i + 2);
    if (two.indexOf(p2) >= 0){ out.push({ t:'op', v:p2 }); i += 2; continue; }
    if ('+-*/%<>=()[],.:{}'.indexOf(c) >= 0){ out.push({ t:'op', v:c }); i++; continue; }
    throw new Error('无法识别的字符：' + c);
  }
  out.push({ t:'eof' });
  return out;
}

class PyExprParser {
  constructor(tokens){ this.tokens = tokens; this.i = 0; }
  peek(){ return this.tokens[this.i] || { t:'eof' }; }
  next(){ return this.tokens[this.i++]; }
  isName(v){ const t = this.peek(); return t.t === 'name' && t.v === v; }
  isOp(v){ const t = this.peek(); return t.t === 'op' && t.v === v; }
  eatOp(v){ if (this.isOp(v)){ this.next(); return true; } return false; }
  eatName(v){ if (this.isName(v)){ this.next(); return true; } return false; }
  expectOp(v){ if (!this.eatOp(v)) throw new Error('这里需要 “' + v + '”'); }
  parse(){
    const e = this.parseOr();
    if (this.peek().t !== 'eof') throw new Error('表达式末尾有多余内容');
    return e;
  }
  parseOr(){
    let l = this.parseAnd();
    while (this.eatName('or')) l = { t:'bin', op:'or', a:l, b:this.parseAnd() };
    return l;
  }
  parseAnd(){
    let l = this.parseNot();
    while (this.eatName('and')) l = { t:'bin', op:'and', a:l, b:this.parseNot() };
    return l;
  }
  parseNot(){
    if (this.eatName('not')) return { t:'un', op:'not', a:this.parseNot() };
    return this.parseCompare();
  }
  parseCompare(){
    let l = this.parseAdd();
    while (true){
      const t = this.peek();
      if (t.t === 'op' && ['==','!=','<','>','<=','>='].indexOf(t.v) >= 0){
        this.next();
        l = { t:'bin', op:t.v, a:l, b:this.parseAdd() };
      } else if (this.isName('in')){
        this.next();
        l = { t:'bin', op:'in', a:l, b:this.parseAdd() };
      } else if (this.isName('not') && this.tokens[this.i+1] && this.tokens[this.i+1].v === 'in'){
        this.next(); this.next();
        l = { t:'bin', op:'not in', a:l, b:this.parseAdd() };
      } else break;
    }
    return l;
  }
  parseAdd(){
    let l = this.parseMul();
    while (this.isOp('+') || this.isOp('-')){
      const op = this.next().v;
      l = { t:'bin', op:op, a:l, b:this.parseMul() };
    }
    return l;
  }
  parseMul(){
    let l = this.parsePow();
    while (this.isOp('*') || this.isOp('/') || this.isOp('//') || this.isOp('%')){
      const op = this.next().v;
      l = { t:'bin', op:op, a:l, b:this.parsePow() };
    }
    return l;
  }
  parsePow(){
    let l = this.parseUnary();
    if (this.eatOp('**')) l = { t:'bin', op:'**', a:l, b:this.parsePow() };
    return l;
  }
  parseUnary(){
    if (this.eatOp('-')) return { t:'un', op:'-', a:this.parseUnary() };
    if (this.eatOp('+')) return this.parseUnary();
    return this.parsePostfix();
  }
  parsePostfix(){
    let e = this.parseAtom();
    while (true){
      if (this.eatOp('(')){
        const args = [];
        const kwargs = [];
        if (!this.isOp(')')){
          while (true){
            const tk = this.peek();
            const nx = this.tokens[this.i + 1];
            if (tk.t === 'name' && nx && nx.t === 'op' && nx.v === '='){
              const name = this.next().v;
              this.next();
              kwargs.push({ name:name, expr:this.parseOr() });
            } else {
              args.push(this.parseOr());
            }
            if (!this.eatOp(',')) break;
            if (this.isOp(')')) break;
          }
        }
        this.expectOp(')');
        e = { t:'call', fn:e, args:args, kwargs:kwargs };
      } else if (this.eatOp('[')){
        let start = null;
        if (!this.isOp(':') && !this.isOp(']')) start = this.parseOr();
        if (this.eatOp(':')){
          let end = null, step = null;
          if (!this.isOp(':') && !this.isOp(']')) end = this.parseOr();
          if (this.eatOp(':')){
            if (!this.isOp(']')) step = this.parseOr();
          }
          this.expectOp(']');
          e = { t:'slice', obj:e, start:start, end:end, step:step };
        } else {
          if (start === null) throw new Error('这里需要一个值');
          this.expectOp(']');
          e = { t:'index', obj:e, index:start };
        }
      } else if (this.eatOp('.')){
        const n = this.next();
        if (n.t !== 'name') throw new Error('属性名不合法');
        e = { t:'attr', obj:e, name:n.v };
      } else break;
    }
    return e;
  }
  parseAtom(){
    const t = this.next();
    if (t.t === 'num' || t.t === 'str') return { t:t.t, v:t.v };
    if (t.t === 'name'){
      if (t.v === 'True') return { t:'bool', v:true };
      if (t.v === 'False') return { t:'bool', v:false };
      if (t.v === 'None') return { t:'none' };
      return { t:'name', v:t.v };
    }
    if (t.t === 'op' && t.v === '('){
      const e = this.parseOr();
      this.expectOp(')');
      return e;
    }
    if (t.t === 'op' && t.v === '['){
      const items = [];
      if (!this.isOp(']')){
        while (true){
          items.push(this.parseOr());
          if (!this.eatOp(',')) break;
          if (this.isOp(']')) break;
        }
      }
      this.expectOp(']');
      return { t:'list', items:items };
    }
    if (t.t === 'op' && t.v === '{'){
      const pairs = [];
      if (!this.isOp('}')){
        while (true){
          const key = this.parseOr();
          this.expectOp(':');
          const val = this.parseOr();
          pairs.push({ key:key, val:val });
          if (!this.eatOp(',')) break;
          if (this.isOp('}')) break;
        }
      }
      this.expectOp('}');
      return { t:'dict', pairs:pairs };
    }
    throw new Error('这里需要一个值');
  }
}

function parsePyExpr(text){
  const p = new PyExprParser(pyTokenize(text));
  return p.parse();
}

function stripPyComment(line){
  let q = null;
  for (let i = 0; i < line.length; i++){
    const c = line[i];
    if (q){
      if (c === '\\'){ i++; continue; }
      if (c === q) q = null;
    } else {
      if (c === '"' || c === "'") q = c;
      else if (c === '#') return line.slice(0, i);
    }
  }
  return line;
}

function pyPreprocess(code){
  const out = [];
  String(code || '').split(/\r?\n/).forEach(function(raw, i){
    let s = stripPyComment(raw).replace(/\t/g, '    ').replace(/\s+$/, '');
    if (!s.trim()) return;
    const indent = s.match(/^ */)[0].length;
    out.push({ no:i + 1, indent:indent, text:s.trim() });
  });
  return out;
}

function findTopAssignment(text){
  let depth = 0, q = null;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (q){
      if (c === '\\'){ i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'"){ q = c; continue; }
    if (c === '(' || c === '[' || c === '{'){ depth++; continue; }
    if (c === ')' || c === ']' || c === '}'){ depth--; continue; }
    if (depth !== 0) continue;
    for (const op of ['+=','-=','*=','/=','%=','=']){
      if (text.startsWith(op, i)){
        if (op === '='){
          if (text[i-1] === '=' || text[i-1] === '!' || text[i-1] === '<' || text[i-1] === '>') continue;
          if (text[i+1] === '=') continue;
        }
        return { lhs:text.slice(0, i).trim(), op:op, rhs:text.slice(i + op.length).trim() };
      }
    }
  }
  return null;
}

function normalizeScriptPunctuation(code){
  const src = String(code == null ? '' : code);
  const isOpenQuote = function(c){ return c === '"' || c === "'" || c === '“' || c === '‘'; };
  const isAnyQuote = function(c){ return isOpenQuote(c) || c === '”' || c === '’'; };
  const closeFor = function(c){ return c === '“' ? '”' : c === '‘' ? '’' : c; };
  const normQuote = function(c){ return c === '“' || c === '”' ? '"' : c === '‘' || c === '’' ? "'" : c; };
  const normPunct = function(c){
    if (c === '（') return '(';
    if (c === '）') return ')';
    if (c === '：') return ':';
    if (c === '【') return '[';
    if (c === '】') return ']';
    if (c === '，') return ',';
    return c;
  };
  let out = '';
  let i = 0;
  let mode = 'code';       // code | comment | string | expr | exprString
  let quote = '';          // closing quote in string mode
  let fstring = false;
  let depth = 0;
  let exprQuote = '';
  while (i < src.length){
    const c = src[i];
    if (mode === 'comment'){
      out += c;
      if (c === '\n') mode = 'code';
      i++;
      continue;
    }
    if (mode === 'string'){
      if (c === '\\' && i + 1 < src.length){ out += c + src[i + 1]; i += 2; continue; }
      if (fstring && c === '{'){
        if (src[i + 1] === '{'){ out += '{{'; i += 2; continue; }
        out += '{'; depth = 1; mode = 'expr'; i++; continue;
      }
      if (fstring && c === '}'){ out += c; i++; continue; }
      if (c === quote){ out += normQuote(c); mode = 'code'; i++; continue; }
      out += c;
      i++;
      continue;
    }
    if (mode === 'exprString'){
      if (c === '\\' && i + 1 < src.length){ out += c + src[i + 1]; i += 2; continue; }
      if (c === exprQuote){ out += normQuote(c); mode = 'expr'; i++; continue; }
      out += c;
      i++;
      continue;
    }
    if (mode === 'expr'){
      if (isAnyQuote(c)){
        exprQuote = closeFor(c === '”' || c === '’' ? (c === '”' ? '“' : '‘') : c);
        out += normQuote(c);
        mode = 'exprString';
        i++;
        continue;
      }
      if (c === '{'){ depth++; out += c; i++; continue; }
      if (c === '}'){
        depth--;
        out += c;
        i++;
        if (depth <= 0) mode = 'string';
        continue;
      }
      out += normPunct(c);
      i++;
      continue;
    }
    // code / comment start
    if (c === '#'){ mode = 'comment'; out += c; i++; continue; }
    // f-string prefix
    if ((c === 'f' || c === 'F') && isAnyQuote(src[i + 1])){
      const q = src[i + 1];
      out += c + normQuote(q);
      quote = closeFor(q);
      fstring = true;
      mode = 'string';
      i += 2;
      continue;
    }
    if (isAnyQuote(c)){
      quote = closeFor(c === '”' ? '“' : c === '’' ? '‘' : c);
      out += normQuote(c);
      fstring = false;
      mode = 'string';
      i++;
      continue;
    }
    out += normPunct(c);
    i++;
  }
  return out;
}

function normalizeChineseSyntax(code){ return normalizeScriptPunctuation(code); }

function parsePythonScript(code){
  code = normalizeChineseSyntax(code);
  const lines = pyPreprocess(code);
  if (!lines.length) return [];
  if (lines[0].indent !== 0) throw new Error('第 ' + lines[0].no + ' 行：第一行不能缩进');
  const r = parsePyBlock(lines, 0, 0);
  if (r.next < lines.length) throw new Error('第 ' + lines[r.next].no + ' 行：缩进不对');
  return r.nodes;
}

function parsePyBlock(lines, start, indent){
  const nodes = [];
  let i = start;
  while (i < lines.length && lines[i].indent === indent){
    if (/^(elif|else|except|finally)\b/.test(lines[i].text)) break;
    const r = parsePyStmt(lines, i, indent);
    nodes.push(r.node); i = r.next;
  }
  return { nodes:nodes, next:i };
}

function parsePyBody(lines, start, parentIndent){
  if (start >= lines.length || lines[start].indent <= parentIndent){
    const no = start < lines.length ? lines[start].no : (lines.length ? lines[lines.length-1].no : 0);
    throw new Error('第 ' + no + ' 行：这里需要缩进的代码块');
  }
  const childIndent = lines[start].indent;
  const r = parsePyBlock(lines, start, childIndent);
  if (r.next < lines.length && lines[r.next].indent > childIndent){
    throw new Error('第 ' + lines[r.next].no + ' 行：缩进不对');
  }
  return r;
}

function splitTopLevel(text, sep){
  const out = [];
  let buf = '', depth = 0, q = null;
  for (let i=0;i<text.length;i++){
    const c = text[i];
    if (q){
      buf += c;
      if (c === '\\'){ if (i+1 < text.length) buf += text[++i]; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'"){ q = c; buf += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (c === sep && depth === 0){ out.push(buf.trim()); buf = ''; }
    else buf += c;
  }
  out.push(buf.trim());
  return out.filter(Boolean);
}

function parsePyStmt(lines, i, indent){
  const line = lines[i];
  const text = line.text;
  const no = line.no;

  let im = /^import\s+([A-Za-z_][A-Za-z0-9_.]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/.exec(text);
  if (im){
    if (im[1] === 'randomring') return { node:{ t:'noop', line:no }, next:i+1 };
    return { node:{ t:'import', module:im[1], alias:im[2] || im[1].split('.')[0], line:no }, next:i+1 };
  }
  im = /^from\s+([A-Za-z_][A-Za-z0-9_.]*)\s+import\s+(.+)$/.exec(text);
  if (im){
    if (im[1] === 'randomring') return { node:{ t:'noop', line:no }, next:i+1 };
    const names = im[2].split(',').map(function(x){ return x.trim(); }).filter(Boolean).map(function(x){
      const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/.exec(x);
      return m ? { name:m[1], alias:m[2] || m[1] } : { name:x, alias:x };
    });
    return { node:{ t:'fromimport', module:im[1], names:names, line:no }, next:i+1 };
  }
  if (text === 'try:'){
    const body = parsePyBody(lines, i+1, indent);
    let j = body.next;
    const handlers = [];
    while (j < lines.length && lines[j].indent === indent && /^except\b/.test(lines[j].text) && lines[j].text.endsWith(':')){
      const l = lines[j];
      let header = l.text.slice(6, -1).trim();
      let type = '', varName = '';
      const asm = /^(.*?)\s+as\s+([A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*)$/.exec(header);
      if (asm){ type = asm[1].trim(); varName = asm[2]; }
      else type = header;
      if (varName) checkCustomName(varName);
      const b = parsePyBody(lines, j+1, indent);
      handlers.push({ type:type, name:varName, body:b.nodes, line:l.no });
      j = b.next;
    }
    let elseBody = null, finallyBody = null;
    if (j < lines.length && lines[j].indent === indent && /^else\s*:$/.test(lines[j].text)){
      const b = parsePyBody(lines, j+1, indent);
      elseBody = b.nodes; j = b.next;
    }
    if (j < lines.length && lines[j].indent === indent && /^finally\s*:$/.test(lines[j].text)){
      const b = parsePyBody(lines, j+1, indent);
      finallyBody = b.nodes; j = b.next;
    }
    if (!handlers.length && !finallyBody) throw new Error('第 ' + no + ' 行：try 后面需要 except 或 finally');
    return { node:{ t:'try', body:body.nodes, handlers:handlers, elseBody:elseBody, finallyBody:finallyBody, line:no }, next:j };
  }
  let defm = /^def\s+([A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*)\s*\(([^)]*)\)\s*:$/.exec(text);
  if (defm){
    checkCustomName(defm[1]);
    const raw = defm[2].trim();
    const parts = raw ? splitTopLevel(raw, ',') : [];
    const params = [];
    const defaults = [];
    let sawDefault = false;
    parts.forEach(function(part){
      const asg = findTopAssignment(part);
      let name = part, defExpr = null;
      if (asg && asg.op === '='){
        name = asg.lhs;
        defExpr = asg.rhs;
      }
      if (!/^[A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*$/.test(name)){
        throw new Error('第 ' + no + ' 行：参数名不合法：' + part);
      }
      checkCustomName(name);
      if (defExpr !== null){
        sawDefault = true;
        defaults.push({ name:name, expr:parsePyExpr(defExpr) });
      } else if (sawDefault){
        throw new Error('第 ' + no + ' 行：有默认值的参数后面不能再有无默认参数：' + name);
      }
      params.push(name);
    });
    const body = parsePyBody(lines, i+1, indent);
    return { node:{ t:'def', name:defm[1], params:params, defaults:defaults, body:body.nodes, line:no }, next:body.next };
  }
  if (text === 'return') return { node:{ t:'return', value:null, line:no }, next:i+1 };
  if (/^return\s+/.test(text)) return { node:{ t:'return', value:parsePyExpr(text.slice(7).trim()), line:no }, next:i+1 };
  if (text === 'raise') return { node:{ t:'raise', value:null, line:no }, next:i+1 };
  if (/^raise\s+/.test(text)) return { node:{ t:'raise', value:parsePyExpr(text.slice(6).trim()), line:no }, next:i+1 };
  if (/^if\s+/.test(text) && text.endsWith(':')){
    const condText = text.slice(2, -1).trim();
    const branches = [];
    let cur = { cond:parsePyExpr(condText), line:no };
    let body = parsePyBody(lines, i+1, indent);
    cur.body = body.nodes;
    branches.push(cur);
    let j = body.next;
    while (j < lines.length && lines[j].indent === indent && /^elif\s+/.test(lines[j].text) && lines[j].text.endsWith(':')){
      const l2 = lines[j];
      const c2 = l2.text.slice(4, -1).trim();
      const b2 = parsePyBody(lines, j+1, indent);
      branches.push({ cond:parsePyExpr(c2), body:b2.nodes, line:l2.no });
      j = b2.next;
    }
    let elseBody = null;
    if (j < lines.length && lines[j].indent === indent && /^else\s*:$/.test(lines[j].text)){
      const b3 = parsePyBody(lines, j+1, indent);
      elseBody = b3.nodes;
      j = b3.next;
    }
    return { node:{ t:'if', branches:branches, elseBody:elseBody, line:no }, next:j };
  }
  let m = /^for\s+([A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*)\s+in\s+(.+)\s*:$/.exec(text);
  if (m){
    const body = parsePyBody(lines, i+1, indent);
    return { node:{ t:'for', name:m[1], iter:parsePyExpr(m[2].trim()), body:body.nodes, line:no }, next:body.next };
  }
  m = /^while\s+(.+)\s*:$/.exec(text);
  if (m){
    const body = parsePyBody(lines, i+1, indent);
    return { node:{ t:'while', cond:parsePyExpr(m[1].trim()), body:body.nodes, line:no }, next:body.next };
  }
  if (text === 'break') return { node:{ t:'break', line:no }, next:i+1 };
  if (text === 'continue') return { node:{ t:'continue', line:no }, next:i+1 };
  if (text === 'pass') return { node:{ t:'noop', line:no }, next:i+1 };
  if (text.endsWith(':')) throw new Error('第 ' + no + ' 行：不支持这种语法');
  if (/^(def|class|return|import)\b/.test(text)) throw new Error('第 ' + no + ' 行：暂不支持 ' + text.split(/\s/)[0]);

  const asg = findTopAssignment(text);
  if (asg){
    const lhsTokens = pyTokenize(asg.lhs);
    const lp = new PyExprParser(lhsTokens);
    const target = lp.parse();
    if (['name','attr','index'].indexOf(target.t) < 0) throw new Error('第 ' + no + ' 行：左边不能赋值');
    return { node:{ t:'assign', target:target, op:asg.op, expr:parsePyExpr(asg.rhs), line:no }, next:i+1 };
  }
  return { node:{ t:'expr', expr:parsePyExpr(text), line:no }, next:i+1 };
}

/* ---------- 运行时 ---------- */
class PyKw { constructor(obj){ this.obj = obj || {}; } }

const PY_RESERVED = new Set([
  'ring','goto','run','show','help','input','get_location','print',
  'len','str','int','float','abs','min','max','range','random','randint',
  'True','False','None','time','turtle','requests','request','tkinter','_autogoto','_reset'
]);
function checkCustomName(name){
  if (PY_RESERVED.has(name)) throw new Error('不能使用内置名 ' + name + ' 作为自定义变量名');
}
class PyFunction {
  constructor(name, params, defaults, body, closure){
    this.__pyFunc = true;
    this.name = name;
    this.params = params;
    this.defaults = defaults || {};
    this.body = body;
    this.closure = closure;
  }
}
class PyReturn {
  constructor(value){ this.value = value; }
}
function pyKw(args){
  const last = args[args.length - 1];
  return last instanceof PyKw ? last.obj : {};
}
function pyPos(args){
  const last = args[args.length - 1];
  return last instanceof PyKw ? args.slice(0, -1) : args;
}

class PyBreak {}
class PyContinue {}
const PY_BREAK = new PyBreak();
const PY_CONTINUE = new PyContinue();

function pyTruthy(v){
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function pyEq(a, b){
  if (Array.isArray(a) && Array.isArray(b)){
    if (a.length !== b.length) return false;
    for (let i=0;i<a.length;i++) if (!pyEq(a[i], b[i])) return false;
    return true;
  }
  return a === b;
}

function pyNum(v, what){
  if (typeof v !== 'number' || !isFinite(v)) throw new Error((what || '这里') + '需要数字');
  return v;
}

function pyIter(v){
  if (Array.isArray(v)) return v.slice();
  if (typeof v === 'string') return v.split('');
  throw new Error('这里需要列表或字符串');
}

function pyAdd(a, b){
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  if (typeof a === 'string' && typeof b === 'string') return a + b;
  if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
  throw new Error('不能这样相加');
}

function pyError(type, msg){
  const e = new Error(msg);
  e.pyType = type;
  return e;
}

function pyBinOp(op, a, b){
  switch (op){
    case '+': return pyAdd(a, b);
    case '-': return pyNum(a) - pyNum(b);
    case '*':
      if (typeof a === 'number' && typeof b === 'number') return a * b;
      if (typeof a === 'string' && typeof b === 'number') return a.repeat(Math.max(0, b));
      if (Array.isArray(a) && typeof b === 'number'){ let out=[]; for(let i=0;i<b;i++) out=out.concat(a); return out; }
      throw new Error('不能这样相乘');
    case '/': { const x = pyNum(a), y = pyNum(b); if (y === 0) throw pyError('ZeroDivisionError', '除以零'); return x / y; }
    case '//': { const x = pyNum(a), y = pyNum(b); if (y === 0) throw pyError('ZeroDivisionError', '除以零'); return Math.floor(x / y); }
    case '%': { const x = pyNum(a), y = pyNum(b); if (y === 0) throw pyError('ZeroDivisionError', '除以零'); const r = x % y; return r !== 0 && (r < 0) !== (y < 0) ? r + y : r; }
    case '**': return Math.pow(pyNum(a), pyNum(b));
    case '==': return pyEq(a, b);
    case '!=': return !pyEq(a, b);
    case '<': return pyNum(a) < pyNum(b);
    case '>': return pyNum(a) > pyNum(b);
    case '<=': return pyNum(a) <= pyNum(b);
    case '>=': return pyNum(a) >= pyNum(b);
    case 'in':
      if (typeof b === 'string') return b.indexOf(String(a)) >= 0;
      if (Array.isArray(b)) return b.some(function(x){ return pyEq(x, a); });
      throw new Error('in 右边需要列表或字符串');
    case 'not in': return !pyBinOp('in', a, b);
    default: throw new Error('不支持的运算符 ' + op);
  }
}

function pyStringMethod(str, name){
  if (name === 'split'){
    return function(){
      if (arguments.length > 2) throw new Error('split 最多 2 个参数');
      const hasSep = arguments.length >= 1 && arguments[0] !== undefined && arguments[0] !== null;
      const sep = hasSep ? String(arguments[0]) : null;
      let max = arguments.length >= 2 ? Number(arguments[1]) : -1;
      if (!Number.isInteger(max)) throw new Error('split 的 maxsplit 需要整数');
      if (sep === '') throw pyError('ValueError', 'split 分隔符不能为空');
      let parts;
      if (sep === null){
        const t = str.trim();
        if (!t) return [];
        parts = t.split(/\s+/);
      } else {
        parts = str.split(sep);
      }
      if (max >= 0 && parts.length > max + 1){
        const head = parts.slice(0, max);
        head.push(parts.slice(max).join(sep === null ? ' ' : sep));
        return head;
      }
      return parts;
    };
  }
  if (name === 'strip') return function(){ return str.trim(); };
  if (name === 'lstrip') return function(){ return str.replace(/^\s+/, ''); };
  if (name === 'rstrip') return function(){ return str.replace(/\s+$/, ''); };
  if (name === 'lower') return function(){ return str.toLowerCase(); };
  if (name === 'upper') return function(){ return str.toUpperCase(); };
  if (name === 'startswith') return function(x){ return str.startsWith(String(x)); };
  if (name === 'endswith') return function(x){ return str.endsWith(String(x)); };
  if (name === 'find') return function(x){ return str.indexOf(String(x)); };
  if (name === 'count') return function(x){ return str.split(String(x)).length - 1; };
  if (name === 'replace'){
    return function(a, b, n){
      a = String(a); b = String(b);
      if (n === undefined || n < 0) return str.split(a).join(b);
      let count = Number(n);
      if (!Number.isInteger(count) || count < 0) throw new Error('replace 次数需要非负整数');
      const parts = str.split(a);
      return parts.slice(0, count + 1).join(b) + (parts.length > count + 1 ? a + parts.slice(count + 1).join(a) : '');
    };
  }
  if (name === 'join'){
    return function(list){
      if (!Array.isArray(list)) throw new Error('join 需要列表');
      return list.map(function(x){ return String(x); }).join(str);
    };
  }
  return null;
}

function pyListMethod(arr, name){
  if (name === 'append'){
    return function(){
      if (arguments.length !== 1) throw new Error('append 需要 1 个参数');
      arr.push(arguments[0]);
      return null;
    };
  }
  if (name === 'pop'){
    return function(){
      if (arguments.length > 1) throw new Error('pop 最多 1 个参数');
      if (!arr.length) throw pyError('IndexError', '不能从空列表 pop');
      let n = arguments.length ? Number(arguments[0]) : arr.length - 1;
      if (!Number.isInteger(n)) throw new Error('pop 的索引需要整数');
      if (n < 0) n += arr.length;
      if (n < 0 || n >= arr.length) throw pyError('IndexError', 'pop 索引越界');
      return arr.splice(n, 1)[0];
    };
  }
  if (name === 'remove'){
    return function(){
      if (arguments.length !== 1) throw new Error('remove 需要 1 个参数');
      for (let i = 0; i < arr.length; i++){
        if (pyEq(arr[i], arguments[0])){ arr.splice(i, 1); return null; }
      }
      throw pyError('ValueError', '列表里没有这个元素');
    };
  }
  if (name === 'index'){
    return function(){
      if (arguments.length < 1 || arguments.length > 3) throw new Error('index 需要 1 到 3 个参数');
      const target = arguments[0];
      let start = arguments.length > 1 ? Number(arguments[1]) : 0;
      let end = arguments.length > 2 ? Number(arguments[2]) : arr.length;
      if (!Number.isInteger(start) || !Number.isInteger(end)) throw new Error('index 的 start/end 需要整数');
      if (start < 0) start += arr.length;
      if (end < 0) end += arr.length;
      start = Math.max(0, start); end = Math.min(arr.length, end);
      for (let i = start; i < end; i++){
        if (pyEq(arr[i], target)) return i;
      }
      throw pyError('ValueError', '列表里没有这个元素');
    };
  }
  if (name === 'count'){
    return function(x){
      let n = 0;
      for (let i = 0; i < arr.length; i++) if (pyEq(arr[i], x)) n++;
      return n;
    };
  }
  if (name === 'insert'){
    return function(i, value){
      if (arguments.length !== 2) throw new Error('insert 需要 2 个参数');
      let n = Number(i);
      if (!Number.isInteger(n)) throw new Error('insert 的索引需要整数');
      if (n < 0) n = Math.max(0, n + arr.length);
      n = Math.min(arr.length, n);
      arr.splice(n, 0, value);
      return null;
    };
  }
  return null;
}

async function evalPyExpr(node, ctx){
  switch (node.t){
    case 'num': case 'str': case 'bool': return node.v;
    case 'none': return null;
    case 'list': {
      const out = [];
      for (const it of node.items) out.push(await evalPyExpr(it, ctx));
      return out;
    }
    case 'dict': {
      const out = {};
      for (const p of node.pairs){
        const k = await evalPyExpr(p.key, ctx);
        out[String(k)] = await evalPyExpr(p.val, ctx);
      }
      return out;
    }
    case 'name': {
      if (node.v in ctx.env) return ctx.env[node.v];
      throw new Error('变量 ' + node.v + ' 还没有定义');
    }
    case 'un': {
      const v = await evalPyExpr(node.a, ctx);
      if (node.op === 'not') return !pyTruthy(v);
      return -pyNum(v);
    }
    case 'bin': {
      if (node.op === 'and'){
        const a = await evalPyExpr(node.a, ctx);
        return pyTruthy(a) ? await evalPyExpr(node.b, ctx) : a;
      }
      if (node.op === 'or'){
        const a = await evalPyExpr(node.a, ctx);
        return pyTruthy(a) ? a : await evalPyExpr(node.b, ctx);
      }
      const a = await evalPyExpr(node.a, ctx);
      const b = await evalPyExpr(node.b, ctx);
      return pyBinOp(node.op, a, b);
    }
    case 'attr': {
      const obj = await evalPyExpr(node.obj, ctx);
      if (obj === null || obj === undefined) throw new Error('不能读取空值的属性 ' + node.name);
      if (Array.isArray(obj)){
        const m = pyListMethod(obj, node.name);
        if (m) return m;
      }
      if (typeof obj === 'string'){
        const m = pyStringMethod(obj, node.name);
        if (m) return m;
      }
      return obj[node.name];
    }
    case 'slice': {
      const obj = await evalPyExpr(node.obj, ctx);
      if (!Array.isArray(obj) && typeof obj !== 'string') throw new Error('只有列表或字符串可以切片');
      const len = obj.length;
      let start = node.start == null ? 0 : Number(await evalPyExpr(node.start, ctx));
      let end = node.end == null ? len : Number(await evalPyExpr(node.end, ctx));
      let step = node.step == null ? 1 : Number(await evalPyExpr(node.step, ctx));
      if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(step)) throw new Error('切片参数需要整数');
      if (step === 0) throw new Error('切片步长不能为 0');
      let out = [];
      if (step > 0){
        if (start < 0) start += len;
        if (end < 0) end += len;
        start = Math.max(0, Math.min(len, start));
        end = Math.max(0, Math.min(len, end));
        for (let i = start; i < end; i += step) out.push(obj[i]);
      } else {
        if (start < 0) start += len;
        if (end < 0) end += len;
        start = Math.min(len - 1, start);
        if (node.start == null) start = len - 1;
        end = Math.max(-1, end);
        if (node.end == null) end = -1;
        for (let i = start; i > end; i += step) out.push(obj[i]);
      }
      return typeof obj === 'string' ? out.join('') : out;
    }
    case 'index': {
      const obj = await evalPyExpr(node.obj, ctx);
      const idx = await evalPyExpr(node.index, ctx);
      if (Array.isArray(obj) || typeof obj === 'string'){
        let n = Number(idx);
        if (n < 0) n += obj.length;
        if (!Number.isInteger(n) || n < 0 || n >= obj.length) throw new Error('索引越界：' + idx);
        return obj[n];
      }
      throw new Error('不能这样取下标');
    }
    case 'call': {
      let fn, self = null;
      if (node.fn.t === 'attr'){
        self = await evalPyExpr(node.fn.obj, ctx);
        if (self === null || self === undefined) throw new Error('不能调用空值的 ' + node.fn.name);
        if (Array.isArray(self)){
          fn = pyListMethod(self, node.fn.name) || self[node.fn.name];
        } else if (typeof self === 'string'){
          fn = pyStringMethod(self, node.fn.name) || self[node.fn.name];
        } else {
          fn = self[node.fn.name];
        }
      } else {
        fn = await evalPyExpr(node.fn, ctx);
      }
      if (typeof fn !== 'function' && !(fn && fn.__pyFunc)) throw new Error('这个值不能调用');
      const args = [];
      for (const a of node.args) args.push(await evalPyExpr(a, ctx));
      const kw = {};
      for (const k of (node.kwargs || [])) kw[k.name] = await evalPyExpr(k.expr, ctx);
      if (fn && fn.__pyFunc){
        return await callPyFunction(fn, args, kw, ctx);
      }
      if (Object.keys(kw).length) args.push(new PyKw(kw));
      ctx.check();
      const r = fn.apply(self, args);
      return (r && typeof r.then === 'function') ? await r : r;
    }
    default: throw new Error('未知表达式');
  }
}

async function getPyTargetValue(target, ctx){
  if (target.t === 'name') return ctx.env[target.v];
  if (target.t === 'attr'){
    const obj = await evalPyExpr(target.obj, ctx);
    return obj ? obj[target.name] : undefined;
  }
  if (target.t === 'index'){
    const obj = await evalPyExpr(target.obj, ctx);
    const idx = await evalPyExpr(target.index, ctx);
    return obj[idx];
  }
  throw new Error('无法读取赋值目标');
}

async function setPyTargetValue(target, value, ctx){
  if (target.t === 'name'){
    if (target.v !== '_autogoto' && target.v !== '_reset') checkCustomName(target.v);
    if (target.v === '_autogoto'){
      const b = !!pyTruthy(value);
      ctx.env._autogoto = b;
      if (typeof db !== 'undefined' && db.settings){ db.settings.autoGoto = b; save(); }
      return;
    }
    if (target.v === '_reset'){
      let n = Number(value);
      if (!isFinite(n) || n < 0) throw new Error('_reset 需要非负秒数');
      n = Math.min(60, n);
      ctx.env._reset = n;
      if (typeof db !== 'undefined' && db.settings){ db.settings.avoidReset = n; save(); }
      if (typeof scheduleAvoidReset === 'function') scheduleAvoidReset(currentWheel());
      return;
    }
    ctx.env[target.v] = value;
    if (ctx.funcDepth === 0 && !BUILTIN_NAMES.has(target.v)) ctx.userName.add(target.v);
    return;
  }
  if (target.t === 'attr'){
    const obj = await evalPyExpr(target.obj, ctx);
    if (obj === null || obj === undefined) throw new Error('不能给空值设置属性');
    obj[target.name] = value;
    return;
  }
  if (target.t === 'index'){
    const obj = await evalPyExpr(target.obj, ctx);
    const idx = await evalPyExpr(target.index, ctx);
    if (Array.isArray(obj)){
      let n = Number(idx);
      if (n < 0) n += obj.length;
      if (n < 0 || n >= obj.length) throw new Error('索引越界：' + idx);
      obj[n] = value;
      return;
    }
    if (obj && typeof obj === 'object'){
      obj[idx] = value;
      return;
    }
    throw new Error('不能这样赋值');
  }
  throw new Error('无法赋值');
}

async function callPyFunction(fn, args, kw, ctx){
  if (!fn || !fn.__pyFunc) throw new Error('不是函数');
  kw = kw || {};
  if (args.length > fn.params.length) throw new Error('函数 ' + fn.name + ' 最多接受 ' + fn.params.length + ' 个参数');
  const values = {};
  fn.params.forEach(function(p, i){ if (i < args.length) values[p] = args[i]; });
  Object.keys(kw).forEach(function(k){
    if (fn.params.indexOf(k) < 0) throw new Error('函数 ' + fn.name + ' 没有参数 ' + k);
    if (Object.prototype.hasOwnProperty.call(values, k)) throw new Error('参数 ' + k + ' 重复赋值');
    values[k] = kw[k];
  });
  fn.params.forEach(function(p){
    if (Object.prototype.hasOwnProperty.call(values, p)) return;
    if (fn.defaults && Object.prototype.hasOwnProperty.call(fn.defaults, p)) values[p] = fn.defaults[p];
    else throw new Error('函数 ' + fn.name + ' 缺少参数 ' + p);
  });
  const local = Object.create(fn.closure || ctx.env);
  fn.params.forEach(function(p){ local[p] = values[p]; });
  const saved = ctx.env;
  ctx.env = local;
  ctx.funcDepth = (ctx.funcDepth || 0) + 1;
  try {
    await execPyBlock(fn.body, ctx);
    return null;
  } catch(e){
    if (e instanceof PyReturn) return e.value;
    throw e;
  } finally {
    ctx.funcDepth--;
    ctx.env = saved;
  }
}

async function execPyNode(node, ctx){
  ctx.check();
  switch (node.t){
    case 'noop': return;
    case 'import': {
      const mod = getScriptModule(node.module);
      if (!mod) throw new Error('找不到模块：' + node.module);
      const base = node.module.split('.')[0];
      if (node.alias !== base) checkCustomName(node.alias);
      ctx.env[node.alias] = mod;
      return;
    }
    case 'fromimport': {
      const mod = getScriptModule(node.module);
      if (!mod) throw new Error('找不到模块：' + node.module);
      for (const n of node.names){
        if (n.name === '*'){ Object.keys(mod).forEach(function(k){ if (k.charAt(0) !== '_' && k !== '__pyModule') ctx.env[k] = mod[k]; }); }
        else if (mod[n.name] !== undefined){
          if (PY_RESERVED.has(n.alias)) throw new Error('不能使用内置名 ' + n.alias + ' 作为自定义变量名');
          ctx.env[n.alias] = mod[n.name];
        }
        else throw new Error('模块 ' + node.module + ' 没有 ' + n.name);
      }
      return;
    }
    case 'expr': await evalPyExpr(node.expr, ctx); return;
    case 'assign': {
      let val = await evalPyExpr(node.expr, ctx);
      if (node.op !== '='){
        const cur = await getPyTargetValue(node.target, ctx);
        val = pyBinOp(node.op.slice(0, -1), cur, val);
      }
      await setPyTargetValue(node.target, val, ctx);
      return;
    }
    case 'try': {
      let err = null, control = null;
      try {
        try { await execPyBlock(node.body, ctx); }
        catch(e){
          if (e === PY_BREAK || e === PY_CONTINUE || e instanceof PyReturn) control = e;
          else err = e;
        }
        if (err){
          if (!node.handlers.length) throw err;
          const h = node.handlers[0];
          if (h.name) ctx.env[h.name] = err;
          await execPyBlock(h.body, ctx);
        } else if (node.elseBody){
          await execPyBlock(node.elseBody, ctx);
        }
      } finally {
        if (node.finallyBody) await execPyBlock(node.finallyBody, ctx);
      }
      if (control) throw control;
      return;
    }
    case 'def': {
      checkCustomName(node.name);
      const defs = {};
      for (const d of (node.defaults || [])) defs[d.name] = await evalPyExpr(d.expr, ctx);
      ctx.env[node.name] = new PyFunction(node.name, node.params, defs, node.body, ctx.env);
      return;
    }
    case 'return': {
      if (!ctx.funcDepth) throw new Error('return 只能写在函数里');
      throw new PyReturn(node.value === null ? null : await evalPyExpr(node.value, ctx));
    }
    case 'raise': {
      if (node.value === null) throw new Error('脚本主动抛出异常');
      const v = await evalPyExpr(node.value, ctx);
      if (v instanceof Error) throw v;
      throw new Error(String(v));
    }
    case 'if': {
      for (const br of node.branches){
        if (pyTruthy(await evalPyExpr(br.cond, ctx))){
          await execPyBlock(br.body, ctx); return;
        }
      }
      if (node.elseBody) await execPyBlock(node.elseBody, ctx);
      return;
    }
    case 'while': {
      let guard = 0;
      while (pyTruthy(await evalPyExpr(node.cond, ctx))){
        ctx.check();
        if (++guard > 200000) throw new Error('while 循环超过 200000 次');
        try { await execPyBlock(node.body, ctx); }
        catch(e){ if (e === PY_BREAK) break; if (e === PY_CONTINUE) continue; throw e; }
      }
      return;
    }
    case 'for': {
      const seq = pyIter(await evalPyExpr(node.iter, ctx));
      for (const v of seq){
        ctx.check();
        checkCustomName(node.name);
        ctx.env[node.name] = v;
        if (ctx.funcDepth === 0 && !BUILTIN_NAMES.has(node.name)) ctx.userName.add(node.name);
        try { await execPyBlock(node.body, ctx); }
        catch(e){ if (e === PY_BREAK) break; if (e === PY_CONTINUE) continue; throw e; }
      }
      return;
    }
    case 'break': throw PY_BREAK;
    case 'continue': throw PY_CONTINUE;
    default: throw new Error('未知语句');
  }
}

async function execPyBlock(nodes, ctx){
  for (const n of nodes){
    try {
      await execPyNode(n, ctx);
      if (typeof refreshScriptShows === 'function') refreshScriptShows(ctx.env);
    }
    catch(e){
      if (e === PY_BREAK || e === PY_CONTINUE) throw e;
      if (e && !e.__pyLine){
        e.__pyLine = true;
        e.message = '第 ' + (n.line || '?') + ' 行：' + e.message;
      }
      throw e;
    }
  }
}

async function execScriptNodes(nodes, ctx){
  await execPyBlock(nodes, ctx);
}

const parseScript = parsePythonScript;
