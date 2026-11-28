"use strict";
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const {PRICES,RECURRENCE,createSandboxForm}=require("./studylab-plus-checkout-form.cjs");
const digest=s=>createHash("md5").update(s).digest("hex").toUpperCase();
const customer={firstName:"Test",lastName:"Student",email:"test@example.com",phone:"+94771234567",address:"Sample Address",city:"Colombo"};
const config={enabled:true,environment:"sandbox",merchantId:"test-merchant",merchantSecret:"private-test-secret",returnUrl:"https://studylab.example/success",cancelUrl:"https://studylab.example/cancel",notifyUrl:"https://studylab.example/.netlify/functions/payhere-notify"};
const order={id:"10000000-0000-4000-8000-000000000010",environment:"sandbox",months:3,amountMinor:49900,currency:"LKR"};
for(const m of [1,3,12]){
 const one={...order,months:m,amountMinor:PRICES[m]};
 const x=createSandboxForm(one,customer,config);
 assert.equal(x.environment,"sandbox");assert.equal(x.liveCheckout,false);
 assert.equal(x.endpoint,"https://sandbox.payhere.lk/pay/checkout");
 assert.equal(x.fields.recurrence,RECURRENCE[m]);
 assert.equal(x.fields.duration,"Forever");
 assert.equal(x.fields.amount,(PRICES[m]/100).toFixed(2));
 const expected=digest(config.merchantId+one.id+x.fields.amount+"LKR"+digest(config.merchantSecret));
 assert.equal(x.fields.hash,expected);
 assert.equal(Object.hasOwn(x.fields,"merchantSecret"),false);
 assert.equal(Object.hasOwn(x.fields,"merchant_secret"),false);
}
for(const bad of [{...order,amountMinor:1},{...order,months:2},{...order,environment:"live"},{...order,id:"unsafe"}])assert.throws(()=>createSandboxForm(bad,customer,config),/Untrusted/);
for(const bad of [{...config,enabled:false},{...config,environment:"live"},{...config,merchantSecret:""}])assert.throws(()=>createSandboxForm(order,customer,bad),/disabled/);
for(const bad of ["http://studylab.example/notify","https://localhost/notify","javascript:alert(1)","https://u:p@studylab.example/notify"])assert.throws(()=>createSandboxForm(order,customer,{...config,notifyUrl:bad}),/HTTPS|Invalid/);
for(const bad of [{...customer,email:"x"},{...customer,phone:"123"},{...customer,address:""},{...customer,firstName:"<img>"}])assert.throws(()=>createSandboxForm(order,bad,config),/Customer|Invalid/);
console.log("PASS: sandbox-only checkout form, server prices, all billing periods, protected credentials and public HTTPS callbacks.");
