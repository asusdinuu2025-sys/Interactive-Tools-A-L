"use strict";
// PayHere Lite: ONE-TIME checkout only. Server-side sandbox builder.
// Does not create orders, expose merchant secrets, charge customers or grant Plus.
// Do not import this module in assets/ or deliver its configuration to browsers.
const {createHash}=require("node:crypto");
const PRICES=Object.freeze({1:19900,3:49900,12:179900});
const MD5=value=>createHash("md5").update(value,"utf8").digest("hex").toUpperCase();
function publicHttps(raw){
 if(typeof raw!=="string"||raw.length>2048)throw Error("Public HTTPS URL required");
 let u;try{u=new URL(raw);}catch{throw Error("Public HTTPS URL required");}
 if(u.protocol!=="https:"||u.username||u.password||u.hash||!u.hostname||
    /(?:^|\.)localhost$/i.test(u.hostname)||/^(?:127\.|10\.|192\.168\.)/.test(u.hostname))
    throw Error("Public HTTPS URL required");
 return u.toString();
}
function field(value,max=120){
 if(typeof value!=="string"||!value.trim()||value.length>max||/[\x00-\x1f<>]/.test(value))throw Error("Invalid customer details");
 return value.trim();
}
function buildOneTimeForm(order,customer,settings){
 if(!settings||settings.enabled!==true||settings.environment!=="sandbox"||
    typeof settings.merchantId!=="string"||!settings.merchantId||
    typeof settings.merchantSecret!=="string"||!settings.merchantSecret)
    throw Error("PayHere Lite sandbox checkout disabled");
 if(!order||order.environment!=="sandbox"||!Object.hasOwn(PRICES,order.months)||
    order.amountMinor!==PRICES[order.months]||order.currency!=="LKR"||
    typeof order.id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.id))
    throw Error("Server-created order required");
 if(!customer||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(customer.email||"")||
    !(/^\+?[0-9]{9,15}$/).test(customer.phone||""))throw Error("Valid customer contact required");
 const amount=(order.amountMinor/100).toFixed(2),currency="LKR";
 const merchantId=field(settings.merchantId,80);
 const fields=Object.freeze({
   merchant_id:merchantId,
   order_id:order.id,
   items:"StudyLab Plus - "+order.months+(order.months===1?" month":" months")+" (one-time)",
   amount,currency,
   first_name:field(customer.firstName),
   last_name:field(customer.lastName),
   email:field(customer.email,150),
   phone:field(customer.phone,20),
   address:field(customer.address,200),
   city:field(customer.city,100),
   country:"Sri Lanka",
   return_url:publicHttps(settings.returnUrl),
   cancel_url:publicHttps(settings.cancelUrl),
   notify_url:publicHttps(settings.notifyUrl),
   hash:MD5(merchantId+order.id+amount+currency+MD5(settings.merchantSecret))
 });
 // Recurrence, duration, installment IDs and auto-charge fields MUST NOT appear.
 return Object.freeze({environment:"sandbox",endpoint:"https://sandbox.payhere.lk/pay/checkout",fields,recurring:false,liveCheckout:false});
}
module.exports={PRICES,publicHttps,buildOneTimeForm};
