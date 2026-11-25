"use strict";
// Standalone server-side validation, not a checkout or a database write handler.
// This intentionally allows SANDBOX orders only until merchant approval,
// authoritative reconciliation, and atomic database entitlement updates exist.
const {createHash,timingSafeEqual}=require("node:crypto");
const md5=s=>createHash("md5").update(s,"utf8").digest("hex").toUpperCase();
const maxLength=4096;
const required=["merchant_id","order_id","payment_id","subscription_id","payhere_amount","payhere_currency","status_code","md5sig"];
function parse(body){
 if(typeof body!=="string"||Buffer.byteLength(body,"utf8")>maxLength)throw Error("Invalid callback body");
 const qs=new URLSearchParams(body),data=Object.create(null);
 for(const name of required){
  const all=qs.getAll(name);
  if(all.length!==1||!all[0]||all[0].length>128)throw Error("Missing or duplicate callback field");
  data[name]=all[0];
 }
 for(const field of ["message_type","custom_1"]){const all=qs.getAll(field);if(all.length>1||all.some(x=>x.length>128))throw Error("Duplicate callback metadata");data[field]=all[0]||"";}
 return data;
}
function minorAmount(raw){
 if(!/^\d{1,8}\.\d{2}$/.test(raw))throw Error("Invalid amount format");
 const [units,cents]=raw.split(".");const n=Number(units)*100+Number(cents);
 if(!Number.isSafeInteger(n)||n<=0)throw Error("Invalid amount");
 return n;
}
function verifyNotification(body,config){
 if(!config||config.enabled!==true||config.environment!=="sandbox"||typeof config.merchantId!=="string"||!config.merchantId||typeof config.merchantSecret!=="string"||!config.merchantSecret||!config.order||config.order.environment!=="sandbox")throw Error("Sandbox verification is not configured");
 const p=parse(body),order=config.order;
 if(p.merchant_id!==config.merchantId||p.order_id!==order.id||p.payhere_currency!=="LKR"||minorAmount(p.payhere_amount)!==order.amountMinor||!["1","2","0","-1","-2","-3"].includes(p.status_code))throw Error("Callback does not match the trusted order");
 if(!/^[0-9A-F]{32}$/.test(p.md5sig))throw Error("Invalid callback signature");
 const expected=md5(p.merchant_id+p.order_id+p.payhere_amount+p.payhere_currency+p.status_code+md5(config.merchantSecret));
 if(!timingSafeEqual(Buffer.from(p.md5sig,"ascii"),Buffer.from(expected,"ascii")))throw Error("Invalid callback signature");
 if(!/^[A-Za-z0-9_.:-]{1,128}$/.test(p.payment_id)||!/^[A-Za-z0-9_.:-]{1,128}$/.test(p.subscription_id))throw Error("Invalid provider identifiers");
 // AUTHORIZATION_SUCCESS is NOT a paid installment; only captured installments
 // may be considered for granting access by a future separately audited backend.
 const kind=p.status_code==="2"&&p.message_type==="RECURRING_INSTALLMENT_SUCCESS"?"installment_verified":
   p.status_code==="2"&&p.message_type==="AUTHORIZATION_SUCCESS"?"authorization_only":"status_verified_only";
 return Object.freeze({kind,environment:"sandbox",orderId:order.id,paymentId:p.payment_id,subscriptionId:p.subscription_id,statusCode:p.status_code,messageType:p.message_type,amountMinor:order.amountMinor,currency:"LKR",liveAccess:false});
}
module.exports={parse,minorAmount,verifyNotification};
