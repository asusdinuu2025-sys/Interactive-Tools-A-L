"use strict";
// PayHere Lite single-payment callback verifier. Hash excludes payment_id,
// so a signature alone cannot confirm that a payment was captured.
// This module never grants access or writes to a database.
const {createHash,timingSafeEqual}=require("node:crypto");
const md5=value=>createHash("md5").update(value,"utf8").digest("hex").toUpperCase();
const required=["merchant_id","order_id","payment_id","payhere_amount","payhere_currency","status_code","md5sig"];
function parse(body){
 if(typeof body!=="string"||Buffer.byteLength(body,"utf8")>4096)throw Error("Invalid callback body");
 const data=Object.create(null),params=new URLSearchParams(body);
 for(const name of required){
  const values=params.getAll(name);
  if(values.length!==1||values[0].length<1||values[0].length>128)throw Error("Missing or duplicate callback field");
  data[name]=values[0];
 }
 return data;
}
function amountMinor(value){
 if(!/^\d{1,8}\.\d{2}$/.test(value))throw Error("Unexpected payment amount");
 const [major,minor]=value.split(".");
 return Number(major)*100+Number(minor);
}
function verifyLiteCallback(body,{environment,enabled,merchantId,merchantSecret,order}={}){
 if(!enabled||environment!=="sandbox"||!merchantId||!merchantSecret||order?.environment!=="sandbox")
  throw Error("Sandbox callback not configured");
 const data=parse(body);
 if(data.merchant_id!==merchantId||data.order_id!==order.id||data.payhere_currency!=="LKR"||
    amountMinor(data.payhere_amount)!==order.amountMinor||!["2","0","-1","-2","-3"].includes(data.status_code))
  throw Error("Callback does not match the trusted order");
 if(!/^[0-9A-Fa-f]{32}$/.test(data.md5sig))throw Error("Invalid callback signature");
 const expected=md5(data.merchant_id+data.order_id+data.payhere_amount+data.payhere_currency+data.status_code+md5(merchantSecret));
 if(!timingSafeEqual(Buffer.from(expected,"ascii"),Buffer.from(data.md5sig.toUpperCase(),"ascii")))
  throw Error("Invalid callback signature");
 if(!/^[A-Za-z0-9_.:-]{1,128}$/.test(data.payment_id))throw Error("Invalid payment identifier");
 return Object.freeze({kind:"signed_unreconciled_one_time",environment:"sandbox",
  orderId:order.id,paymentId:data.payment_id,amountMinor:order.amountMinor,currency:"LKR",
  providerStatus:data.status_code,requiresProviderReconciliation:true,sandboxAccess:false,liveAccess:false});
}
function reconcileLiteReceipt(notification,order,providerResponse){
 if(notification?.kind!=="signed_unreconciled_one_time"||notification.providerStatus!=="2"||
   notification.environment!=="sandbox"||notification.liveAccess!==false||
   order?.environment!=="sandbox"||notification.orderId!==order.id||
   providerResponse?.status!==1||!Array.isArray(providerResponse.data))
  throw Error("Unverified sandbox receipt");
 const matching=providerResponse.data.filter(p=>p&&String(p.payment_id)===notification.paymentId&&
   p.order_id===order.id);
 if(matching.length!==1)throw Error("Ambiguous or missing payment");
 const pay=matching[0];
 const cents=typeof pay.amount==="number"?Math.round(pay.amount*100):NaN;
 if(pay.status!=="RECEIVED"||pay.currency!=="LKR"||!Number.isSafeInteger(cents)||
   Math.abs(pay.amount*100-cents)>0.00001||cents!==order.amountMinor||
   notification.amountMinor!==order.amountMinor||notification.currency!=="LKR")
  throw Error("Provider receipt mismatch");
 return Object.freeze({receiptVerified:true,environment:"sandbox",orderId:order.id,paymentId:notification.paymentId,
  amountMinor:order.amountMinor,periodMonths:order.months,requiresServerTransaction:true,
  sandboxAccess:false,liveAccess:false});
}
module.exports={parse,amountMinor,verifyLiteCallback,reconcileLiteReceipt};
