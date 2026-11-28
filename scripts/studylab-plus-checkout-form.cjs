"use strict";
// Server-side sandbox-only builder, not a deployed checkout endpoint.
// Never import into browser JavaScript or expose merchantSecret.
const {createHash}=require("node:crypto");
const PRICES=Object.freeze({1:19900,3:49900,12:179900});
const RECURRENCE=Object.freeze({1:"1 Month",3:"3 Month",12:"1 Year"});
const md5=s=>createHash("md5").update(s,"utf8").digest("hex").toUpperCase();
function safeUrl(input){
 if(typeof input!=="string"||input.length>2048)throw Error("Invalid callback URL");
 let url;try{url=new URL(input);}catch{throw Error("Invalid callback URL");}
 if(url.protocol!=="https:"||url.username||url.password||url.hash||!url.hostname||["localhost","127.0.0.1","0.0.0.0"].includes(url.hostname))throw Error("Public HTTPS callback required");
 return url.href;
}
const text=(v,max=100)=>{
 if(typeof v!=="string"||v.trim().length<1||v.trim().length>max||/[\u0000-\u001f<>]/.test(v))throw Error("Invalid customer field");
 return v.trim();
};
function createSandboxForm(order,customer,config){
 if(!config||config.enabled!==true||config.environment!=="sandbox"||typeof config.merchantId!=="string"||!config.merchantId||typeof config.merchantSecret!=="string"||!config.merchantSecret)throw Error("Checkout disabled");
 if(!order||order.environment!=="sandbox"||!Object.hasOwn(PRICES,order.months)||order.amountMinor!==PRICES[order.months]||order.currency!=="LKR"||typeof order.id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.id))throw Error("Untrusted order");
 if(!customer||typeof customer.email!=="string"||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)||typeof customer.phone!=="string"||! /^\+?[0-9]{9,15}$/.test(customer.phone))throw Error("Customer contact unavailable");
 const amount=(order.amountMinor/100).toFixed(2),currency="LKR",merchantId=text(config.merchantId,80),orderId=order.id;
 const hash=md5(merchantId+orderId+amount+currency+md5(config.merchantSecret));
 const fields={
  merchant_id:merchantId,order_id:orderId,items:"StudyLab Plus - "+RECURRENCE[order.months],
  amount,currency,recurrence:RECURRENCE[order.months],duration:"Forever",
  first_name:text(customer.firstName),last_name:text(customer.lastName),
  email:text(customer.email,150),phone:text(customer.phone,20),address:text(customer.address,200),
  city:text(customer.city,100),country:"Sri Lanka",
  return_url:safeUrl(config.returnUrl),cancel_url:safeUrl(config.cancelUrl),notify_url:safeUrl(config.notifyUrl),
  hash
 };
 return Object.freeze({environment:"sandbox",endpoint:"https://sandbox.payhere.lk/pay/checkout",fields:Object.freeze(fields),liveCheckout:false});
}
module.exports={PRICES,RECURRENCE,createSandboxForm};
