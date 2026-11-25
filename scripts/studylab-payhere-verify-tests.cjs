"use strict";
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const {parse,minorAmount,verifyNotification}=require("./studylab-payhere-verify.cjs");
const md5=s=>createHash("md5").update(s,"utf8").digest("hex").toUpperCase();
const order={id:"10000000-0000-4000-8000-000000000010",environment:"sandbox",amountMinor:49900};
const config={enabled:true,environment:"sandbox",merchantId:"sandbox-id",merchantSecret:"example-private-test-secret",order};
function payload(changes={}){
 const args={merchant_id:"sandbox-id",order_id:order.id,payment_id:"pay-123",subscription_id:"sub-123",payhere_amount:"499.00",payhere_currency:"LKR",status_code:"2",message_type:"RECURRING_INSTALLMENT_SUCCESS",...changes};
 args.md5sig=md5(args.merchant_id+args.order_id+args.payhere_amount+args.payhere_currency+args.status_code+md5(config.merchantSecret));
 return new URLSearchParams(args).toString();
}
assert.equal(minorAmount("499.00"),49900);
assert.equal(minorAmount("000499.09"),49909);
for(const bad of ["499","499.0","499.000","4e2","0.00","-1.00","Infinity"])assert.throws(()=>minorAmount(bad));
const verified=verifyNotification(payload(),config);
assert.equal(verified.kind,"installment_verified");
assert.equal(verified.liveAccess,false);
assert.equal(verified.amountMinor,49900);
assert.equal(verifyNotification(payload({message_type:"AUTHORIZATION_SUCCESS"}),config).kind,"authorization_only");
assert.equal(verifyNotification(payload({message_type:"RECURRING_INSTALLMENT_FAILED",status_code:"-2"}),config).kind,"status_verified_only");
assert.throws(()=>verifyNotification(payload(),{...config,enabled:false}),/not configured/);
assert.throws(()=>verifyNotification(payload(),{...config,environment:"live"}),/not configured/);
assert.throws(()=>verifyNotification(payload(),{...config,order:{...order,environment:"live"}}),/not configured/);
assert.throws(()=>verifyNotification(payload(),{...config,merchantSecret:"wrong"}),/signature/);
assert.throws(()=>verifyNotification(payload(),{...config,merchantId:"wrong"}),/trusted order/);
assert.throws(()=>verifyNotification(payload(),{...config,order:{...order,amountMinor:19900}}),/trusted order/);
for(const changes of [{order_id:"other"},{payhere_currency:"USD"},{payhere_amount:"999.00"},{status_code:"1"}]){
 assert.throws(()=>verifyNotification(payload(changes),config),/trusted order/);
}
const altered=new URLSearchParams(payload());altered.set("payhere_amount","1.00");
assert.throws(()=>verifyNotification(altered.toString(),config),/trusted order/);
const tampered=new URLSearchParams(payload());tampered.set("message_type","AUTHORIZATION_SUCCESS");
assert.equal(verifyNotification(tampered.toString(),config).kind,"authorization_only"); // message_type not part of the provider checksum
const duplicate=payload()+"&merchant_id=sandbox-id";
assert.throws(()=>verifyNotification(duplicate,config),/duplicate/);
assert.throws(()=>parse("a".repeat(5000)),/Invalid callback body/);
assert.throws(()=>verifyNotification(payload({payment_id:"bad space"}),config),/provider identifiers/);
console.log("PASS: PayHere sandbox checksum, trusted-order matching, authorization/capture distinction, duplicate-field and fail-closed tests.");
