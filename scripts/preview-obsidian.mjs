function decorate(element, options) {
  if (typeof options === 'string') element.className = options;
  else if (options) {
    if (options.cls) element.className = options.cls;
    if (options.text) element.textContent = options.text;
    for (const [key,value] of Object.entries(options.attr || {})) element.setAttribute(key,value);
  }
  return element;
}
HTMLElement.prototype.createEl = function(tag, options) { const element=decorate(document.createElement(tag), options); this.append(element); return element; };
HTMLElement.prototype.createDiv = function(options) { return this.createEl('div',options); };
HTMLElement.prototype.createSpan = function(options) { return this.createEl('span',options); };
HTMLElement.prototype.addClass = function(...names) { this.classList.add(...names); };
HTMLElement.prototype.toggleClass = function(name,value) { this.classList.toggle(name,value); };
HTMLElement.prototype.empty = function() { this.replaceChildren(); };
HTMLElement.prototype.setText = function(text) { this.textContent=text; };
export class Modal {
  constructor(app) {
    this.app=app; this.overlay=document.createElement('div'); this.overlay.className='modal-container';
    this.modalEl=this.overlay.createDiv('modal');
    const close=this.modalEl.createEl('button',{cls:'modal-close-button',text:'×',attr:{'aria-label':'关闭'}});close.onclick=()=>this.close();
    this.titleEl=this.modalEl.createEl('h2',{cls:'modal-title'}); this.contentEl=this.modalEl.createDiv('modal-content');
    this.scope={ register:(modifiers,key,callback)=>{this.shortcut=callback;} };
    this.onKey = event=>{if(event.key==='Escape')this.close();if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();this.shortcut?.();}};
  }
  open() { document.body.append(this.overlay);document.addEventListener('keydown',this.onKey);this.onOpen(); }
  close() { this.onClose();this.overlay.remove();document.removeEventListener('keydown',this.onKey); }
}
export class ButtonComponent {
  constructor(container) {this.buttonEl=container.createEl('button',{attr:{type:'button'}});}
  setButtonText(text){this.buttonEl.textContent=text;return this;}
  setIcon(icon){setIcon(this.buttonEl,icon);return this;}
  setTooltip(text){this.buttonEl.title=text;this.buttonEl.setAttribute('aria-label',text);return this;}
  setDisabled(value){this.buttonEl.disabled=value;return this;}
  setCta(){this.buttonEl.classList.add('mod-cta');return this;}
  onClick(callback){this.buttonEl.onclick=callback;return this;}
}
export class Notice {constructor(text){const toast=document.body.createDiv({cls:'preview-toast',text});setTimeout(()=>toast.remove(),4000);}}
export function setIcon(element,name){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value]of Object.entries({width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,String(value));
  const paths={ 'file-text':'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h6', 'refresh-cw':'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-2l2 2 M4 17l2 2a7 7 0 0 0 12-2', 'pilcrow':'M13 4v16 M18 4v16 M20 4H9a5 5 0 0 0 0 10h4', 'list':'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01','spell-check':'m3 15 4-10 4 10 M4 12h6 m10 3-5 6-3-3','wand-sparkles':'m4 20 13-13 3 3L7 23z M17 3v-2 M21 5h2 M6 3v4 M4 5h4'};
  const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',paths[name]||paths.list);svg.append(p);element.replaceChildren(svg);
}
