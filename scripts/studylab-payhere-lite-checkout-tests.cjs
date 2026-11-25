"use strict";
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const {PRICES,buildOneTimeForm}=require("./studylab-payhere-lite-checkout.cjs");
const md5=v=>createHash("md5").update(v).digest("hex").toUpperCase();
const opts={enabled:true,environment:"sandbox",merchantId:"test-merchant",merchantSecret:"test-private-secret",
 returnUrl:"https://studylablk.netlify.app/index.html",cancelUrl:"https://studylablk.netlify.app/index.html",
 notifyUrl:"https://studylablk.netlify.app/.netlify/functions/payhere-notify"};
const person={firstName:"Sample",lastName:"Student",email:"student@example.com",phone:"+94771234567",address:"Example Street",city:"Kandy"};
const order={id:"10000000-0000-4000-8000-000000000010",environment:"sandbox",months:1,amountMinor:19900,currency:"LKR"};
for(const months of [1,3,12]){
 const updated={...order,months,amountMinor:PRICES[months]};
 const result=buildOneTimeForm(updated,person,opts);
 assert.equal(result.endpoint,"https://sandbox.payhere.lk/pay/checkout");
 assert.equal(result.liveCheckout,false);assert.equal(result.recurring,false);
 assert.equal(result.fields.amount,(PRICES[months]/100).toFixed(2));
 assert.equal(result.fields.hash,md5(opts.merchantId+updated.id+result.fields.amount+"LKR"+md5(opts.merchantSecret)));
 for(const forbidden of ["recurrence","duration","merchantSecret","subscription_id","secret"])assert.equal(Object.hasOwn(result.fields,forbidden),false);
}
for(const altered of [{amountMinor:0},{amountMinor:1},{environment:"live"},{months:2},{currency:"USD"},{id:"not-a-uuid"}])
 assert.throws(()=>buildOneTimeForm({...order,...altered},person,opts),/Server-created/);
for(const altered of [{enabled:false},{environment:"live"},{merchantSecret:""}])
 assert.throws(()=>buildOneTimeForm(order,person,{...opts,...altered}),/disabled/);
for(const value of ["http://studylablk.netlify.app/","https://localhost/notify","https://127.0.0.1/notify","javascript:alert(1)","https://user:pass@domain.tld/notify"])
 assert.throws(()=>buildOneTimeForm(order,person,{...opts,notifyUrl:value}),/HTTPS/);
for(const altered of [{email:"bad email"},{phone:"123"},{address:""},{firstName:"<img>"}])
 assert.throws(()=>buildOneTimeForm(order,{...person,...altered},opts),/customer|details/);
console.log("PASS: Lite one-time plans, server signature, no recurrence, locked prices, safe URL and customer validation.");
