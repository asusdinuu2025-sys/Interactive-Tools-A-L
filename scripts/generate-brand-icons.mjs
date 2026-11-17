/**
 * StudyLab brand icons: dependency-free static PNG renderer.
 * Generates the same selected angular SL + graduation-cap mark used in
 * studylab-pwa.svg, at PWA/desktop/iOS/fav sizes. No glass or animations.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';

const out = 'assets/icon/';
const capOuter = [[79,181],[256,88],[433,181],[256,272]];
const capInner = [[126,181],[256,113],[386,181],[256,245]];
const letterS = [[256,225],[148,278],[148,316],[221,352],[221,370],[148,333],[148,374],[258,430],[258,317],[189,283],[256,249]];
const letterL = [[268,224],[308,248],[308,365],[390,322],[390,367],[268,430]];
const tassel = [[433,242],[426,252],[422,268],[427,281],[433,287],[439,278],[443,263],[438,252]];

function polygon(x,y,pts){
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const a=pts[i],b=pts[j];
    if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
function mix(a,b,t){return a.map((c,i)=>c+(b[i]-c)*Math.max(0,Math.min(1,t)));}
function lineDistance(x,y,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1;
  const t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-x1-t*dx,y-y1-t*dy);
}
function sample(x,y){
  const r=106, cx=Math.max(r,Math.min(512-r,x)),cy=Math.max(r,Math.min(512-r,y));
  if(Math.hypot(x-cx,y-cy)>r) return [0,0,0,0];
  const shade=(x+y)/1024;
  let c=mix([11,35,62],[24,15,54],shade);
  const glow=Math.max(0,1-Math.hypot(x-250,y-255)/290);
  c=mix(c,[33,71,122],glow*.10);
  if(polygon(x,y,letterS)) c=mix([33,226,247],[50,144,250],Math.max(0,(y-220)/230));
  if(polygon(x,y,letterL)) c=mix([66,101,247],[213,111,233],Math.max(0,(y-220)/220));
  if(polygon(x,y,capOuter)&&!polygon(x,y,capInner)) {
    const t=Math.max(0,Math.min(1,(x-79)/354));
    c=t<.5 ? mix([21,216,249],[45,159,251],t*2) : mix([45,159,251],[209,123,247],(t-.5)*2);
  }
  if(lineDistance(x,y,433,181,433,253)<5 || polygon(x,y,tassel)) c=[211,121,242];
  return [c[0],c[1],c[2],255];
}
function crc32(data){
  let c=0xffffffff;
  for(const b of data){c^=b;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}
  return (c^0xffffffff)>>>0;
}
function chunk(type,data){
  const name=Buffer.from(type,'ascii');
  const size=Buffer.alloc(4);size.writeUInt32BE(data.length);
  const check=Buffer.alloc(4);check.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([size,name,data,check]);
}
function createPNG(n){
  const scan=Buffer.alloc(n*(1+n*4));
  for(let y=0;y<n;y++){
    let p=y*(1+n*4);scan[p++]=0;
    for(let x=0;x<n;x++){
      const sum=[0,0,0,0];
      for(const sy of [.25,.75])for(const sx of [.25,.75]){
        const rgba=sample((x+sx)*512/n,(y+sy)*512/n);
        for(let k=0;k<4;k++)sum[k]+=rgba[k];
      }
      for(let k=0;k<4;k++)scan[p++]=Math.round(sum[k]/4);
    }
  }
  const hdr=Buffer.alloc(13);hdr.writeUInt32BE(n,0);hdr.writeUInt32BE(n,4);hdr[8]=8;hdr[9]=6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),
    chunk('IDAT',deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))
  ]);
}
for(const [name,size] of [
  ['android-chrome-512x512.png',512],['icon.png',512],['icon2.png',180],
  ['studylab-192.png',192],['studylab-favicon-32.png',32]
])writeFileSync(out+name,createPNG(size));
// Sync branded browser favicon, iOS icon and manifest URL on every HTML page.
// Only asset references change; existing page markup, functions and CSS remain intact.
for(const page of readdirSync('.').filter(name=>name.endsWith('.html'))){
  const original=readFileSync(page,'utf8');
  const next=original
    .replace(/href="\/assets\/icon\/studylab-pwa\.svg(?:\?[^"]*)?"/g,'href="/assets/icon/studylab-favicon.svg?v=sl-brand-1"')
    .replace(/href="\/assets\/icon\/icon2\.png(?:\?[^"]*)?"/g,'href="/assets/icon/icon2.png?v=sl-brand-1"')
    .replace(/href="\/manifest\.json\?v=[^"]*"/g,'href="/manifest.json?v=sl-brand-1"');
  if(next!==original)writeFileSync(page,next);
}
console.log('StudyLab brand icons generated: 512, 192, 180, 32.');
