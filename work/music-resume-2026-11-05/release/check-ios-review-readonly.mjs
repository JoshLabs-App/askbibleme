import crypto from 'node:crypto';
import fs from 'node:fs';

// Read-only status check for the already-submitted 1.1.8 (141) release.
// Uses the existing App Store Connect key without printing its contents.
const now = Math.floor(Date.now() / 1000);
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const input = b64({alg:'ES256',kid:'9HDA27WY8C',typ:'JWT'}) + '.' +
  b64({iss:'a56f0624-e4a4-438d-be5d-92403dd9969b',iat:now,exp:now+1200,aud:'appstoreconnect-v1'});
const key = fs.readFileSync('/Users/joshua/.appstoreconnect/private_keys/AuthKey_9HDA27WY8C.p8');
const token = input + '.' + crypto.sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
async function get(route) {
  const response = await fetch('https://api.appstoreconnect.apple.com'+route,{
    method:'GET',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)
  });
  if(!response.ok) throw new Error('App Store Connect GET returned HTTP '+response.status);
  return response.json();
}
const [version,review] = await Promise.all([
  get('/v1/appStoreVersions/515255df-2b4c-4976-a369-f387a1bb12d8?include=build'),
  get('/v1/reviewSubmissions/fb9f5d4e-bd05-48d2-8965-9cb0c890abdd')
]);
console.log(JSON.stringify({
  checkedAt:new Date().toISOString(),
  version:version.data.attributes.versionString,
  appStoreState:version.data.attributes.appStoreState,
  releaseType:version.data.attributes.releaseType,
  builds:version.included?.filter(x=>x.type==='builds').map(x=>({build:x.attributes.version,processingState:x.attributes.processingState})),
  reviewState:review.data.attributes.state
},null,2));
