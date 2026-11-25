"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {verifyLiteCallback,reconcileLiteReceipt}=require("./studylab-payhere-lite-verify.cjs");
const md5=x=>crypto.createHash("md5").update(x).digest("hex").toUpperCase();
const order={id:"10000000-0000-4000-8000-000000000010",environment:"sandbox",months:3,amountMinor:49900,currency:"LKR"};
const config={environment:"sandbox",enabled:true,merchantId:"merchant-test",merchantSecret:"test-secret",order};
function message(changes={}){
 const raw={merchant_id:"merchant-test",order_id:order.id,payment_id:"pay-001",payhere_amount:"499.00",payhere_currency:"LKR",status_code:"2",...changes};
 raw.md5sig=md5(raw.merchant_id+raw.order_id+raw.payhere_amount+raw.payhere_currency+raw.status_code+md5(config.merchantSecret));
 return new URLSearchParams(raw).toString();
}
let signed=verifyLiteCallback(message(),config);
assert.equal(signed.liveAccess,false);assert.equal(signed.sandboxAccess,false);
assert.equal(signed.kind,"signed_unreconciled_one_time");assert.equal(signed.requiresProviderReconciliation,true);
for(const configChange of [{environment:"live"},{enabled:false},{merchantId:"other"},{merchantSecret:"wrong"}])
 assert.throws(()=>verifyLiteCallback(message(),{...config,...configChange}));
for(const tamper of [{order_id:"other"},{payhere_amount:"199.00"},{status_code:"1"},{payhere_currency:"USD"}])
 assert.throws(()=>verifyLiteCallback(message(tamper),config));
assert.throws(()=>verifyLiteCallback(message()+"&payment_id=pay-002",config),/duplicate/);
const records={status:1,data:[{payment_id:"pay-001",order_id:order.id,status:"RECEIVED",currency:"LKR",amount:499}]};
const receipt=reconcileLiteReceipt(signed,order,records);
assert.equal(receipt.receiptVerified,true);assert.equal(receipt.liveAccess,false);
for(const bad of [{status:-1,data:[]},{status:1,data:[]},{status:1,data:[records.data[0],records.data[0]]},
  {status:1,data:[{...records.data[0],status:"REFUNDED"}]},
  {status:1,data:[{...records.data[0],status:"CHARGEBACKED"}]},
  {status:1,data:[{...records.data[0],amount:199}]},
  {status:1,data:[{...records.data[0],order_id:"other"}]}])
 assert.throws(()=>reconcileLiteReceipt(signed,order,bad));
assert.throws(()=>reconcileLiteReceipt({...signed,providerStatus:"0"},order,records));
assert.throws(()=>reconcileLiteReceipt({...signed,environment:"live"},order,records));
console.log("PASS: PayHere Lite signed callbacks and captured receipts checked against sandbox orders; no access granted.");
