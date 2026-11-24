const assert=require("node:assert/strict");
const {classify,defaults,normalize}=require("../assets/js/studylab-guardian-rules.js");
const on={...defaults,enabled:true};
const cases=[
 [{text:"Hello"},on,"allow"],[{text:"අද පාඩම් කරමු"},on,"allow"],[{text:"ada maths karamu"},on,"allow"],
 [{text:"https://example.org/lesson"},on,"allow"],[{text:"https://example.org@other.invalid"},on,"review"],
 [{text:"javascript: example"},on,"review"],[{text:"https://example.org@other.invalid"},defaults,"allow"],
 [{text:"hello",recentCount:12},on,"review"],[{text:"hello",recentCount:11},on,"allow"],
 [{text:"hello",surface:"posts",recentCount:4},on,"review"],[{text:"hello",surface:"comments",recentCount:8},on,"review"],
 [{text:"hello",recentCount:12},{...on,spam:false},"allow"],[{text:"hello",hasMedia:true},on,"review"],
 [{text:"hello",surface:"chat",hasMedia:true},{...on,chat:false},"allow"],
];
for(const [input,config,want] of cases)assert.equal(classify(input,config).decision,want,JSON.stringify(input));
assert.equal(normalize({enabled:"true"}).enabled,false);
assert.throws(()=>classify({surface:"unknown"},on));
console.log("Guardian: 16 deterministic sandbox assertions passed");
