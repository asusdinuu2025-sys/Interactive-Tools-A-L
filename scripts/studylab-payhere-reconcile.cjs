"use strict";
// Data-only adapter for results retrieved by an authenticated SERVER-side
// PayHere Subscription Manager API client. Never trust client-supplied snapshots.
const PLAN_PRICES=Object.freeze({1:19900,3:49900,12:179900});
const cents=value=>{
 if(typeof value!=="number"||!Number.isFinite(value)||value<=0||value>10000000)return null;
 const result=Math.round(value*100);
 return Math.abs(value*100-result)<1e-5?result:null;
};
function reconcileNotification(notice,order,subscriptions,payments){
 if(!notice||notice.kind!=="signature_verified_unreconciled"||!notice.requiresProviderReconciliation||notice.environment!=="sandbox"||notice.liveAccess!==false||notice.sandboxAccess!==false)
  throw Error("Signed, unreconciled sandbox notification required");
 if(!order||order.environment!=="sandbox"||!Object.hasOwn(PLAN_PRICES,order.months)||order.amountMinor!==PLAN_PRICES[order.months]||order.currency!=="LKR"||notice.orderId!==order.id||notice.amountMinor!==order.amountMinor||notice.currency!=="LKR")
  throw Error("Order mismatch");
 if(subscriptions?.status!==1||!Array.isArray(subscriptions.data)||payments?.status!==1||!Array.isArray(payments.data))
  throw Error("Server provider lookup incomplete");
 const subs=subscriptions.data.filter(s=>s&&String(s.subscription_id)===notice.subscriptionId&&s.order_id===order.id);
 if(subs.length!==1)throw Error("Subscription not found uniquely");
 const sub=subs[0];
 if(!["ACTIVE","COMPLETED"].includes(sub.status)||sub.currency!=="LKR"||cents(sub.amount)!==order.amountMinor)
  throw Error("Subscription not confirmed");
 const matched=payments.data.filter(p=>p&&String(p.payment_id)===notice.paymentId&&p.order_id===order.id);
 if(matched.length!==1)throw Error("Payment not found uniquely");
 const pay=matched[0];
 if(pay.status!=="RECEIVED"||pay.currency!=="LKR"||cents(pay.amount)!==order.amountMinor)
  throw Error("No matching captured receipt");
 // Paid-through date is NOT present in this provider response; an audited server
 // reconciler must derive it and atomically write to DB before granting access.
 return Object.freeze({sandboxReceiptVerified:true,orderId:order.id,subscriptionId:notice.subscriptionId,paymentId:notice.paymentId,amountMinor:order.amountMinor,currency:"LKR",requiresPaidPeriodCalculation:true,liveAccess:false});
}
module.exports={cents,reconcileNotification};