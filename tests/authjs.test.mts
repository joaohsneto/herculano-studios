import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import express from '../backend/node_modules/express/index.js';
import cookieParser from '../backend/node_modules/cookie-parser/index.js';
import { customFetch } from '../backend/node_modules/@auth/express/index.js';
import type { AddressInfo } from 'node:net';
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/test';
process.env.JWT_SECRET = 'test-secret-at-least-thirty-two-characters';
process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.FRONTEND_URL = 'http://localhost:3000';
const {authConfig} = await import('../backend/src/auth/config.ts');
const {default: router} = await import('../backend/src/routes/auth.ts');
const {prisma} = await import('../backend/src/lib/prisma.ts');

test('Auth.js Google: PKCE/state/nonce, canonical URL, local identity, collision and unverified email', async t => {
 const users:any[]=[];
 const oldFind=prisma.user.findUnique, oldThrow=prisma.user.findUniqueOrThrow, oldCreate=prisma.user.create;
 prisma.user.findUnique = (async ({where}:any)=>users.find(u=>Object.entries(where).every(([k,v])=>u[k]===v))||null) as typeof prisma.user.findUnique;
 prisma.user.findUniqueOrThrow = (async ({where}:any)=>{const u=users.find(u=>Object.entries(where).every(([k,v])=>u[k]===v));if(!u)throw Error('Not found');return u;}) as typeof prisma.user.findUniqueOrThrow;
 prisma.user.create = (async ({data}:any)=>{const user={id:'local-'+users.length,role:'CUSTOMER',...data};users.push(user);return user;}) as typeof prisma.user.create;
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 let nonce='';let claims:Record<string,unknown>={};let tokenCalls=0;
 const json=(data:unknown)=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 const fakeFetch:typeof fetch=async (input,init)=>{
  const url=input instanceof Request ? input.url : String(input);
  if(url.includes('.well-known'))return json({issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',userinfo_endpoint:'https://openidconnect.googleapis.com/v1/userinfo',id_token_signing_alg_values_supported:['RS256'],response_types_supported:['code'],subject_types_supported:['public']});
  if(url.includes('/userinfo'))return json({sub:claims.sub||'google-sub',email:claims.email||'visitor@example.com',email_verified:claims.email_verified??true,name:'Visitante'});
  if(url.includes('/certs'))return json({keys:[{...publicKey.export({format:'jwk'}),kid:'test',alg:'RS256',use:'sig'}]});
  if(url==='https://oauth2.googleapis.com/token'){
   tokenCalls++;
   const requestBody=input instanceof Request ? await input.clone().text() : String(init?.body);
   assert.ok(requestBody.includes('code_verifier='));
   assert.ok(requestBody.includes(encodeURIComponent('http://localhost:3000/api/auth/callback/google')));
   const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url');
   const payload=Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:process.env.GOOGLE_CLIENT_ID,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,nonce,sub:'google-sub',email:'visitor@example.com',email_verified:true,name:'Visitante',...claims})).toString('base64url');
   const signature=sign('RSA-SHA256',Buffer.from(`${header}.${payload}`),privateKey).toString('base64url');
   return json({access_token:'mock-access-token',token_type:'Bearer',expires_in:300,id_token:`${header}.${payload}.${signature}`});
  }
  throw Error('Unexpected provider URL');
 };
 authConfig.logger = { error(){},warn(){},debug(){} };
 const google=authConfig.providers.find(p=>typeof p!=='function'&&p.id==='google') as any;
 google.options[customFetch]=fakeFetch;
 const app=express();app.use(express.json());app.use(cookieParser());app.use('/api/auth',router);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 const jar=new Map<string,string>();
 async function request(path:string,options:RequestInit={}){
  const res=await fetch(origin+path,{...options,redirect:'manual',headers:{cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),'x-forwarded-host':'attacker.example',...options.headers}});
  for(const c of res.headers.getSetCookie()){const first=c.split(';')[0];const i=first.indexOf('=');jar.set(first.slice(0,i),first.slice(i+1));}
  return res;
 }
 async function begin(){jar.clear();const csrf=(await (await request('/api/auth/csrf')).json()).csrfToken;
  const response=await request('/api/auth/signin/google',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'},body:new URLSearchParams({csrfToken:csrf,callbackUrl:'/account'})});
  const url=new URL((await response.json()).url);assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:3000/api/auth/callback/google');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('state'));nonce=url.searchParams.get('nonce')!;assert.ok(nonce);return url.searchParams.get('state')!;
 }
 try {
  const state=await begin();const response=await request('/api/auth/callback/google?code=test&state='+encodeURIComponent(state));
  assert.equal(response.status,302);assert.equal(response.headers.get('location'),'http://localhost:3000/account');assert.equal(users.length,1);
  const session=await (await request('/api/auth/session')).json();assert.equal(session.user.id,'local-0');assert.equal(session.user.role,'CUSTOMER');
  const again=await begin();await request('/api/auth/callback/google?code=again&state='+encodeURIComponent(again));assert.equal(users.length,1);
  const calls=tokenCalls;await begin();const invalid=await request('/api/auth/callback/google?code=invalid&state=attacker');assert.match(invalid.headers.get('location')||'',/error=/);assert.equal(tokenCalls,calls);
  claims={sub:'other-google-id',email:'visitor@example.com'};const conflict=await begin();const collision=await request('/api/auth/callback/google?code=conflict&state='+encodeURIComponent(conflict));assert.match(collision.headers.get('location')||'',/account_exists/);assert.equal(users.length,1);
  claims={sub:'unverified',email_verified:false,email:'other@example.com'};const unverified=await begin();const rejected=await request('/api/auth/callback/google?code=unverified&state='+encodeURIComponent(unverified));assert.match(rejected.headers.get('location')||'',/AccessDenied/);assert.equal(users.length,1);
  claims={nonce:'wrong'};const wrongNonce=await begin();const rejectedNonce=await request('/api/auth/callback/google?code=nonce&state='+encodeURIComponent(wrongNonce));assert.match(rejectedNonce.headers.get('location')||'',/error=/);
 }finally{prisma.user.findUnique=oldFind;prisma.user.findUniqueOrThrow=oldThrow;prisma.user.create=oldCreate;await new Promise<void>(resolve=>server.close(()=>resolve()));await prisma.$disconnect();}
});
