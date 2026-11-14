// Safe mocked integration test: no network calls, real user data or AI tokens.
const assert = require("node:assert/strict");
process.env.STUDYLAB_AI_GROQ = "smoke-test-only-secret";
const {handler} = require("../netlify/functions/gemini.js");

const calls = [];
let allow = true;
function fakeResponse(status, json) {
  return {ok:status >= 200 && status < 300,status,json:async () => json};
}
global.fetch = async (url, options) => {
  const address = String(url);
  calls.push({url:address, headers:options?.headers, body:options?.body});
  if (address.endsWith("/auth/v1/user")) return fakeResponse(200,{id:"test-user"});
  if (address.endsWith("/rest/v1/rpc/studylab_ai_atomic_reserve")) {
    assert.equal(options.headers.Authorization, "Bearer header.payload.signature");
    const input = JSON.parse(options.body);
    assert.match(input.p_ip_hash,/^[a-f0-9]{64}$/);
    return fakeResponse(200,[{allowed:allow,reason:allow?"":"weekly_limit",remaining:allow?55:0,retry_after:0}]);
  }
  if (address.endsWith("/chat/completions")) {
    assert.equal(options.headers.Authorization, "Bearer smoke-test-only-secret");
    return fakeResponse(200,{choices:[{message:{content:"**Bold** and \\(x^2\\)"}}]});
  }
  throw new Error("Unexpected network request "+address);
};

function event(authorized = true) {
  return {
    httpMethod:"POST",
    headers:{
      ...(authorized ? {authorization:"Bearer header.payload.signature"} : {}),
      "x-nf-client-connection-ip":"198.51.100.9"
    },
    body:JSON.stringify({message:"Explain acceleration",history:[]})
  };
}

async function check() {
  let response=await handler(event());
  assert.equal(response.statusCode,200,"valid Bearer token must reach AI provider");
  let data=JSON.parse(response.body);
  assert.equal(data.remaining,55);
  assert.ok(data.text.includes("**Bold**"));
  assert.equal(calls.filter(x=>x.url.includes("studylab_ai_atomic_reserve")).length,1,
    "exactly one atomic RPC should be called per accepted prompt");

  allow=false;
  response=await handler(event());
  data=JSON.parse(response.body);
  assert.equal(response.statusCode,429,"weekly quota remains enforced");
  assert.equal(data.code,"WEEKLY_LIMIT");
  assert.equal(calls.filter(x=>x.url.includes("/chat/completions")).length,1,
    "blocked requests must not reach the provider");

  response=await handler(event(false));
  assert.equal(response.statusCode,401,"missing authentication must be rejected");
  console.log("StudyLab AI Bearer token / quota / provider smoke tests passed.");
}
check().catch(error=>{console.error(error);process.exitCode=1;});
