"use strict";
const assert=require("node:assert/strict");
const {cents,reconcileNotification}=require("./studylab-payhere-reconcile.cjs");
const order={id:"10000000-0000-4000-8000-000000000010",months:3,environment:"sandbox",amountMinor:49900,currency:"LKR"};
const notice={kind:"signature_verified_unreconciled",requiresProviderReconciliation:true,environment:"sandbox",orderId:order.id,amountMinor:49900,currency:"LKR",subscriptionId:"sub-007",paymentId:"pay-009",sandboxAccess:false,liveAccess:false};
const subscription={subscription_id:"sub-007",order_id:order.id,status:"ACTIVE",amount:499,currency:"LKR"};
const payment={payment_id:"pay-009",order_id:order.id,status:"RECEIVED",amount:499,currency:"LKR"};
const response=(x)=>({status:1,data:[x]});
assert.equal(cents(499),49900);
assert.equal(cents(499.01),49901);
for(const n of [Infinity,NaN,-1,0,"499",499.001])assert.equal(cents(n),null);
const r=reconcileNotification(notice,order,response(subscription),response(payment));
assert.equal(r.sandboxReceiptVerified,true);
assert.equal(r.requiresPaidPeriodCalculation,true);
assert.equal(r.liveAccess,false);
assert.throws(()=>reconcileNotification({...notice,environment:"live"},order,response(subscription),response(payment)),/Signed/);
assert.throws(()=>reconcileNotification({...notice,sandboxAccess:true},order,response(subscription),response(payment)),/Signed/);
assert.throws(()=>reconcileNotification(notice,{...order,environment:"live"},response(subscription),response(payment)),/Order/);
assert.throws(()=>reconcileNotification(notice,{...order,amountMinor:19900},response(subscription),response(payment)),/Order/);
assert.throws(()=>reconcileNotification(notice,order,{status:-1,data:[]},response(payment)),/lookup/);
assert.throws(()=>reconcileNotification(notice,order,{status:1,data:[subscription,subscription]},response(payment)),/uniquely/);
for(const changes of [{order_id:"other"},{currency:"USD"},{amount:1},{status:"FAILED"}]){
 assert.throws(()=>reconcileNotification(notice,order,response({...subscription,...changes}),response(payment)),/Subscription/);
}
assert.throws(()=>reconcileNotification(notice,order,response(subscription),{status:1,data:[payment,payment]}),/uniquely/);
for(const changes of [{order_id:"other"},{currency:"USD"},{amount:1},{status:"REFUNDED"},{status:"PENDING"}]){
 assert.throws(()=>reconcileNotification(notice,order,response(subscription),response({...payment,...changes})),/Payment|captured/);
}
console.log("PASS: isolated PayHere subscription/payment reconciliation, exact order and amount, duplicate records, no live entitlement.");
