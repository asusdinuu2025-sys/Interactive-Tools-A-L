"use strict";
// Offline model only. No credentials, network requests or real entitlements.
// Times are UTC milliseconds; period ends are explicit verified provider fields.
const PRICES=Object.freeze({1:19900,3:49900,12:179900});
const validTime=n=>Number.isSafeInteger(n)&&n>0;
function initial(order){
 if(!order||order.environment!=="sandbox"||!Object.hasOwn(PRICES,order.months)||order.amountMinor!==PRICES[order.months]||order.currency!=="LKR"||typeof order.id!=="string"||!order.id)throw Error("Invalid sandbox order");
 return {order:{...order},payments:{},events:{},state:"pending",paidUntil:null,nextBillingAt:null,cancelledAt:null,lastEventAt:0,subscriptionId:null};
}
function apply(previous,event){
 const s=structuredClone(previous),o=s.order;
 if(!event||event.environment!=="sandbox"||event.orderId!==o.id||event.currency!==o.currency||event.amountMinor!==o.amountMinor||typeof event.id!=="string"||!event.id||!validTime(event.at))throw Error("Event does not match sandbox order");
 if(!["confirmed","failed","cancelled","refunded","disputed"].includes(event.kind))throw Error("Invalid event kind");
 if(typeof event.subscriptionId!=="string"||!event.subscriptionId)throw Error("Missing subscription identifier");
 if(s.subscriptionId&&s.subscriptionId!==event.subscriptionId)throw Error("Subscription mismatch");
 const fingerprint=JSON.stringify([event.kind,event.paymentId,event.at,event.paidUntil,event.nextBillingAt,event.subscriptionId]);
 if(Object.hasOwn(s.events,event.id)){if(s.events[event.id]!==fingerprint)throw Error("Conflicting event replay");return s;}
 // Null-prototype data is not guaranteed after cloning; use own properties for identifiers.
 if(["__proto__","constructor","prototype"].includes(event.id)||["__proto__","constructor","prototype"].includes(event.paymentId))throw Error("Invalid identifier");
 s.events[event.id]=fingerprint;s.subscriptionId=event.subscriptionId;
 if(event.kind==="cancelled"){
  s.cancelledAt=Math.max(s.cancelledAt||0,event.at);
  if(event.at>=s.lastEventAt&&s.state!=="disputed"){s.state="cancelled";s.nextBillingAt=null;s.lastEventAt=event.at;}
  return s;
 }
 if(typeof event.paymentId!=="string"||!event.paymentId)throw Error("Missing payment identifier");
 const p=Object.hasOwn(s.payments,event.paymentId)?s.payments[event.paymentId]:null;
 if(event.kind==="confirmed"){
  if(!validTime(event.paidUntil)||event.paidUntil<=event.at||!validTime(event.nextBillingAt)||event.nextBillingAt<event.at)throw Error("Invalid paid period");
  if(p){if(p.state==="confirmed"&&(p.paidUntil!==event.paidUntil||p.nextBillingAt!==event.nextBillingAt))throw Error("Conflicting payment replay");return s;}
  // Late success following a cancellation is recorded but cannot re-enable renewal.
  s.payments[event.paymentId]={state:"confirmed",at:event.at,paidUntil:event.paidUntil,nextBillingAt:event.nextBillingAt};
 }else if(event.kind==="refunded"||event.kind==="disputed"){
  // A terminal event may arrive before confirmation. Keep the tombstone.
  if(p?.state==="disputed"||p?.state==="refunded")return s;
  s.payments[event.paymentId]={state:event.kind,at:event.at,paidUntil:p?.paidUntil||null};
 }else{
  if(!p)s.payments[event.paymentId]={state:"failed",at:event.at,paidUntil:null};
  if(event.at>=s.lastEventAt&&s.state!=="disputed"&&!s.cancelledAt){s.state="past_due";s.lastEventAt=event.at;}
  return s;
 }
 const confirmed=Object.values(s.payments).filter(x=>x.state==="confirmed").sort((a,b)=>b.paidUntil-a.paidUntil);
 s.paidUntil=confirmed[0]?.paidUntil||null;
 if(Object.values(s.payments).some(x=>x.state==="disputed")){s.state="disputed";s.nextBillingAt=null;}
 else if(s.cancelledAt){s.state="cancelled";s.nextBillingAt=null;}
 else if(event.at>=s.lastEventAt){s.state=s.paidUntil?"active":"pending";s.nextBillingAt=confirmed[0]?.nextBillingAt||null;}
 s.lastEventAt=Math.max(s.lastEventAt,event.at);
 return s;
}
function snapshot(s,now){
 if(!validTime(now))throw Error("Invalid clock");
 return {environment:"sandbox",state:s.state!=="disputed"&&s.paidUntil&&s.paidUntil<=now?"expired":s.state,
 sandboxAccess:s.state!=="disputed"&&Boolean(s.paidUntil&&s.paidUntil>now),
 liveAccess:false,paidUntil:s.paidUntil,nextBillingAt:s.nextBillingAt,confirmedMinor:Object.values(s.payments).filter(p=>p.state==="confirmed").length*s.order.amountMinor};
}
module.exports={PRICES,initial,apply,snapshot};
