/* 
   BRAINNOVA ENGINE LOGIC
   Handles Memory, UI, and Models
*/

// --- 1. CONFIGURATION ---
const MODELS = {
  v1: { id: 'v1', name: 'v1.5 Standard', color: '#A3A3A3' },
  v2: { id: 'v2', name: 'v2 DeepThought', color: '#60a5fa' },
  v6: { id: 'v6', name: 'v6 Web Surfer', color: '#8b5cf6' }
};

const System = {
  model: 'v1',
  thinking: false,
  pending: null, 
  
  init() {
    Memory.load();
    UI.msg("System Online. Ready for input.\nTry: `teach: {\"topic\":\"x\", \"core\":\"y\"}`", "ai", "BOOT");
    DataManager.updateUI();
  }
};

// --- 2. MEMORY (LocalStorage) ---
const Memory = {
  db: {},
  KEY: 'brainnova_db',

  load() {
    const raw = localStorage.getItem(this.KEY);
    this.db = raw ? JSON.parse(raw) : {};
  },

  save(topic, data) {
    this.db[topic.toLowerCase()] = data;
    this.persist();
  },

  persist() {
    localStorage.setItem(this.KEY, JSON.stringify(this.db));
    DataManager.updateUI();
  },

  find(text) {
    const lower = text.toLowerCase();
    if(this.db[lower]) return lower;
    const keys = Object.keys(this.db);
    return keys.find(k => lower.includes(k) || k.includes(lower));
  },

  reset() {
    localStorage.removeItem(this.KEY);
    this.db = {};
    this.persist();
  }
};

// --- 3. INTELLIGENCE ENGINE ---
const AI = {
  
  async process(text) {
    const lower = text.toLowerCase();

    // A. COMMANDS
    if(lower === 'help') return { text: "Commands:\n• `reset` (Wipe)\n• `teach: {json}` (Advanced)\n• `Topic is Definition` (Simple)", reason: "HELP", conf: 100 };
    if(lower === 'reset') { Memory.reset(); return { text: "Memory wiped.", reason: "SYSTEM", conf: 100 }; }

    // B. MODEL ROUTING
    if(System.model === 'v6') return await this.runWeb(text);
    if(System.model === 'v2') return this.runDeep(text);
    return this.runStandard(text, lower);
  },

  // MODEL v1.5: Standard & Teaching
  runStandard(text, lower) {
    // 1. Structured Teach Command
    const teachRegex = /^teach:\s*(\{.*\})$/i;
    const match = text.match(teachRegex);
    
    if(match) {
      try {
        const obj = JSON.parse(match[1]);
        if(obj.topic && obj.core) {
          Memory.save(obj.topic, obj);
          if(!obj.why) obj.why = "Imported via console";
          return { 
            text: `**Learned:** ${obj.topic}\n**Definition:** ${obj.core}\n(Structure Saved)`, 
            reason: "JSON INJECTION", 
            conf: 100 
          };
        } else {
          return { text: "JSON must contain 'topic' and 'core' keys.", reason: "SYNTAX ERROR", conf: 0 };
        }
      } catch(e) {
        return { text: "Invalid JSON format. Ensure keys are quoted.\nEx: `{\"topic\":\"hi\"}`", reason: "SYNTAX ERROR", conf: 0 };
      }
    }

    // 2. Memory Recall
    const topic = Memory.find(text);
    if(topic) {
      const d = Memory.db[topic];
      return { text: `**${d.topic || topic}**\n${d.core}`, reason: "MEMORY HIT", conf: 100 };
    }

    // 3. Simple Teaching (Pattern Match)
    const defMatch = text.match(/^([\w\s]+)\s+(?:is|means)\s+(.+)$/i);
    if(defMatch && !text.includes('?')) {
      const t = defMatch[1].trim();
      const c = defMatch[2].trim();
      System.pending = { topic: t, core: c };
      return { text: `I don't know **${t}**. Save as:\n"${c}"?`, reason: "PATTERN DETECT", conf: 50 };
    }

    // 4. Confirmation
    if(System.pending && lower.match(/\b(yes|ok|save)\b/)) {
      Memory.save(System.pending.topic, { topic: System.pending.topic, core: System.pending.core });
      System.pending = null;
      return { text: "Saved.", reason: "WRITE", conf: 100 };
    }

    return { text: "Unknown. Use 'teach:' or switch to v6 to search online.", reason: "MISS", conf: 0 };
  },

  // MODEL v2: Deep Thought
  runDeep(text) {
    const topic = Memory.find(text);
    if(!topic) return { text: "I need data to analyze. Teach me first.", reason: "NO DATA", conf: 0 };
    
    const d = Memory.db[topic];
    let out = `**Analysis: ${d.topic || topic}**\n${d.core}`;
    
    if(d.why) out += `\n\n**Logic:** ${d.why}`;
    if(d.how && Array.isArray(d.how)) out += `\n\n**Process:**\n` + d.how.map(h=>`• ${h}`).join('\n');
    
    return { text: out, reason: "DEEP RECALL", conf: 100 };
  },

  // MODEL v6: Web (Async)
  async runWeb(text) {
    const q = text.replace(/search|find|define/i, '').trim();
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
      if(res.status === 404) throw new Error("Not Found");
      const json = await res.json();
      if(json.extract) {
        Memory.save(json.title, { topic: json.title, core: json.extract, why: "Web Scraped", how: ["Wikipedia"] });
        return { text: `**${json.title}**\n${json.extract}\n\n[Auto-saved to Memory]`, reason: "WEB FETCH", conf: 100 };
      }
    } catch(e) {
      return { text: "Could not find valid data online.", reason: "404", conf: 0 };
    }
  }
};

// --- 4. UI HANDLERS ---
const UI = {
  box: document.getElementById('chat-container'),
  
  msg(txt, type, reason) {
    const div = document.createElement('div');
    div.className = `msg-row ${type === 'user' ? 'user-row' : 'ai-row'}`;
    
    const av = document.createElement('div');
    av.className = `avatar ${type}`;
    if(type==='user') av.innerHTML = `<svg width="20" height="20"><use href="#icon-send"/></svg>`;
    else {
      const c = MODELS[System.model].color;
      av.style.borderColor = c; av.style.color = c;
      av.innerHTML = `<svg width="20" height="20"><use href="#icon-brain"/></svg>`;
    }

    const content = document.createElement('div');
    content.className = 'msg-content';
    
    if(type === 'ai') {
      const c = MODELS[System.model].color;
      content.innerHTML = `<div class="meta" style="color:${c}"><span class="badge" style="border-color:${c}">${MODELS[System.model].id.toUpperCase()}</span> ${reason}</div>`;
    }
    
    const body = document.createElement('div');
    body.className = 'txt';
    if(type === 'user') body.innerText = txt;
    else this.type(body, typeof txt === 'object' ? txt.text : txt); 
    
    content.appendChild(body);
    div.appendChild(av);
    div.appendChild(content);
    this.box.appendChild(div);
    this.box.scrollTop = this.box.scrollHeight;
  },

  type(el, txt) {
    System.thinking = true;
    el.classList.add('cursor');
    const fmt = txt.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    el.innerHTML = fmt;
    System.thinking = false;
    el.classList.remove('cursor');
  },

  toggleModel() {
    const keys = Object.keys(MODELS);
    let idx = keys.indexOf(System.model);
    idx = (idx + 1) % keys.length;
    System.model = keys[idx];
    document.getElementById('model-label').innerText = MODELS[System.model].name;
    document.documentElement.style.setProperty('--accent', MODELS[System.model].color);
  }
};

const DataManager = {
  modal: document.getElementById('modal'),
  open() { this.modal.classList.add('open'); this.updateUI(); },
  close() { this.modal.classList.remove('open'); },
  
  updateUI() {
    const keys = Object.keys(Memory.db);
    document.getElementById('stat-count').innerText = keys.length;
    const kb = (new Blob([JSON.stringify(Memory.db)]).size / 1024).toFixed(2);
    document.getElementById('stat-size').innerText = kb + " KB";
  },

  export() {
    const blob = new Blob([JSON.stringify(Memory.db, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'brainnova_backup.json';
    a.click();
  },

  import(input) {
    const file = input.files[0];
    if(!file) return;
    const r = new FileReader();
    r.onload = e => {
      try {
        const json = JSON.parse(e.target.result);
        const arr = Array.isArray(json) ? json : [json]; 
        let count = 0;
        arr.forEach(item => {
          if(item.topic && item.core) {
            Memory.db[item.topic.toLowerCase()] = item;
            count++;
          }
        });
        Memory.persist();
        UI.msg(`Batch imported ${count} items.`, 'ai', 'DATA');
        this.close();
      } catch(err) { alert("Invalid JSON"); }
    };
    r.readAsText(file);
    input.value = '';
  },

  wipe() {
    if(confirm("Delete all memories?")) {
      Memory.reset();
      this.close();
      UI.msg("Memory Wiped.", 'ai', 'RESET');
    }
  }
};

// --- 5. INPUT HANDLING ---
async function handleSend() {
  const inp = document.getElementById('input');
  const val = inp.value.trim();
  if(!val || System.thinking) return;
  
  inp.value = '';
  UI.msg(val, 'user');
  
  const res = await AI.process(val);
  UI.msg(res, 'ai', res.reason);
}

document.getElementById('input').addEventListener('keypress', e => {
  if(e.key === 'Enter') handleSend();
});

System.init();
