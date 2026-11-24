/* Plus launch preview. No payment collection or browser-side entitlement grants. */
(function(root){
"use strict";
const core=["Live Study Room and standard timer","Social and Chat","Past papers and simulations","Existing profile pictures and themes","Tasks, notes and bookmarks","Guardian safety screening"];
const planned=["Ad-free experience","Plus membership badge","Premium profile covers and frames","Custom backgrounds and appearance","Compact and micro floating timer","Extra Pet designs","Advanced study reports"];
function normalize(s){return {enabled:s?.enabled===true,active:s?.active===true&&s?.enabled===true,granted:s?.granted===true,expires_at:s?.expires_at||null,billing_ready:false};}
if(typeof module!=="undefined"&&module.exports){module.exports={normalize,core,planned};return;}
const d=root.document;
const E=(tag,text,cls)=>{const n=d.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const preview=/^deploy-preview-[0-9]+--studylablk\.netlify\.app$/.test(root.location.hostname);
let dialog=null,session=null;
async function status(){try{const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!u||u.is_anonymous)return normalize(null);const r=await a.client.rpc("studylab_plus_status");if(r.error||a.getUser()?.id!==u.id)return normalize(null);return normalize(r.data);}catch(_){return normalize(null);}}
function close(){dialog?.close();}
async function sync(button){if(!button)return;button.hidden=true;const a=root.StudyLabAccount;await a?.ready;const uid=a?.getUser?.()?.id;if(!uid)return;const state=await status();if(a.getUser()?.id!==uid||!button.isConnected)return;button.hidden=!(preview||state.enabled);button.textContent=state.active?"Manage Plus":"Get StudyLab Plus";}
async function open(feature){
 if(dialog?.open)return;
 const a=root.StudyLabAccount;await a?.ready;const u=a?.getUser?.();if(!u||u.is_anonymous)return;
 const state=await status();if(a.getUser()?.id!==u.id||(!preview&&!state.enabled))return;
 if(dialog?.open)return;
 const previous=d.activeElement;session=u.id;
 const node=E("dialog",null,"sl-plus-dialog");dialog=node;node.setAttribute("aria-label","StudyLab Plus plans");
 const head=E("header",null,"sl-plus-head"),x=E("button","×","sl-plus-close");x.type="button";x.setAttribute("aria-label","Close membership plans");x.onclick=close;
 head.append(E("span","STUDYLAB MEMBERSHIP","sl-plus-eyebrow"),x);
 const title=E("h2",state.active?"Your StudyLab Plus":"Make StudyLab yours");
 const sub=E("p",feature?"Planned Plus feature: "+String(feature):"Keep learning free. Unlock extra ways to personalize your workspace.");
 const banner=E("p",state.active?(state.expires_at?"Complimentary membership · Expires "+new Date(state.expires_at).toLocaleDateString():"Complimentary membership · No expiry"):"Development preview · Purchases and premium features are not yet enabled.","sl-plus-notice");
 const grid=E("div",null,"sl-plus-grid");
 for(const plus of [false,true]){
  const card=E("section",null,"sl-plus-plan"+(plus?" is-plus":""));card.append(E("h3",plus?"✦ StudyLab Plus":"StudyLab Free"),E("strong",plus?"Price to be confirmed":"Rs. 0","sl-plus-price"),E("p",plus?"Monthly renewal planned · Cancel before next billing date":"All existing learning tools remain free"));
  const action=E("button",plus?(state.active?"Membership active":"Checkout not available yet"):(state.active?"Free plan":"Your current plan"),"sl-plus-action");action.type="button";action.disabled=true;card.append(action);
  const list=E("ul");for(const f of (plus?["Everything in Free",...planned]:core))list.append(E("li",f));card.append(list);
  if(plus)card.append(E("small","Planned features shown for comparison; not available to purchase yet."));
  grid.append(card);
 }
 node.append(head,title,sub,banner,grid,E("p","Blue verification remains separately awarded by administrators. Plus membership does not confer administrator rights.","sl-plus-foot"));
 node.addEventListener("cancel",e=>{e.preventDefault();close();});node.addEventListener("close",()=>{node.remove();if(dialog===node){dialog=null;session=null;}previous?.focus?.({preventScroll:true});});
 d.body.append(node);try{node.showModal();x.focus();}catch(_){node.remove();dialog=null;session=null;}
}
root.StudyLabPlus=Object.freeze({status,sync,open});
})(typeof window!=="undefined"?window:globalThis);
