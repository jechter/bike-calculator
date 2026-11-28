import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
const source = readFileSync('supabase/functions/intervals-login/index.ts','utf8').replace(/^import .*;\n/,'');
const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const proof='P'.repeat(43),origin='https://preview.example',redirect=origin+'/maintenance-log/';
function setup(opts={}) {
 const users=new Map([
  ['u1',{id:'u1',email:'rider@example.com',email_confirmed_at:opts.unconfirmed?null:'2026-01-01'}],
  ['u2',{id:'u2',email:opts.ambiguous?'RIDER@example.com':'other@example.com',email_confirmed_at:'2026-01-01'}],
 ]);
 const identities=new Map(opts.linked?[['athlete-1','u1']]:[]),pending=new Map(),calls=[],connections=new Map(opts.mileage?[['u1',{athlete_id:opts.otherMileage?'different-athlete':'athlete-1'}]]:[]);
 let handler,sessionTarget='u1';
 const error=code=>({data:null,error:{code,message:'private upstream details'}});
 const db={
  auth:{
   getUser:vi.fn(async jwt=>({data:{user:jwt==='session-u1'?users.get('u1'):jwt==='session-u2'?users.get('u2'):null},error:null})),
   verifyOtp:vi.fn(async()=>{throw new Error('Shared admin client must never sign in as a user');}),
   admin:{
    createUser:vi.fn(async body=>{if(opts.createFails)return error('failure');const user={id:'new-user',email:body.email,email_confirmed_at:'2026-01-01'};users.set(user.id,user);return{data:{user},error:null};}),
    getUserById:vi.fn(async id=>({data:{user:users.get(id)},error:null})),
    generateLink:vi.fn(async body=>{sessionTarget=[...users.values()].find(u=>u.email===body.email)?.id;return{data:{properties:{hashed_token:'private-one-time-hash'}},error:null};}),
   },
  },
  from:table=>{const call={table};calls.push(call);const query={select:fields=>{call.fields=fields;return query;},eq:(key,value)=>{call.owner=value;return query;},maybeSingle:async()=>({data:connections.get(call.owner)||null,error:null})};return query;},
  rpc:vi.fn(async(name,args)=>{
   calls.push({rpc:name,args});
   if(opts.dbError)return error(opts.dbError);
   if(name==='start_maintenance_intervals_login'){pending.set(args.p_state_hash,{proof_hash:args.p_proof_hash,verifier:args.p_verifier,mode:args.p_mode,owner_id:args.p_owner_id,redirect_uri:args.p_redirect_uri,remember_me:args.p_remember_me});return{data:null,error:null};}
   if(name==='consume_maintenance_intervals_login'){const tx=pending.get(args.p_state_hash);if(!tx||tx.proof_hash!==args.p_proof_hash||opts.expired)return{data:[],error:null};pending.delete(args.p_state_hash);return{data:[tx],error:null};}
   if(name==='unlink_maintenance_intervals_identity'){if(!users.get(args.p_user_id)?.email_confirmed_at)return error('P0004');for(const [athlete,uid]of identities)if(uid===args.p_user_id)identities.delete(athlete);return{data:null,error:null};}
   if(name==='save_maintenance_intervals_token'){connections.set(args.p_user_id,{athlete_id:args.p_athlete_id,access_token:args.p_token});return{data:'version',error:null};}
   if(name==='connect_maintenance_intervals_account'){
    if(opts.banned)return error('P0005');
    let target=identities.get(args.p_athlete_id);
    if(target){if(args.p_owner_id&&args.p_owner_id!==target)return error('P0003');if(opts.saveFails)return error('failure');connections.set(target,{athlete_id:args.p_athlete_id,access_token:args.p_token});return{data:[{user_id:target,email:users.get(target)?.email,needs_account:false}],error:null};}
    if(args.p_owner_id){target=args.p_owner_id;if(!users.get(target)?.email_confirmed_at)return error('P0004');}
    else{
     if(!args.p_verified_email)return error('P0004');
     const matches=[...users.values()].filter(u=>u.email.toLowerCase()===args.p_verified_email);
     if(matches.length>1)return error('P0003');
     if(!matches.length)return{data:[{user_id:null,email:args.p_verified_email,needs_account:true}],error:null};
     if(!matches[0].email_confirmed_at)return error('P0004');target=matches[0].id;
    }
    if([...identities.values()].includes(target))return error('P0003');
    if(opts.saveFails)return error('failure');connections.set(target,{athlete_id:args.p_athlete_id,access_token:args.p_token});identities.set(args.p_athlete_id,target);return{data:[{user_id:target,email:users.get(target).email,needs_account:false}],error:null};
   }
   throw new Error('Unexpected RPC');
  }),
 };
 const isolated={auth:{verifyOtp:vi.fn(async()=>({data:{session:{access_token:'supabase-access',refresh_token:'supabase-refresh',expires_at:Date.now()/1000+3600,user:{id:opts.wrongSession?'u2':sessionTarget,email:users.get(sessionTarget)?.email}}},error:null})),signOut:vi.fn(async()=>({error:null}))}};
 const clients=[];
 const fetch=vi.fn(async(url,options)=>{
  if(opts.offline)throw new Error('private network details');
  if(String(url).endsWith('/auth/v1/settings'))return new Response(JSON.stringify({disable_signup:opts.signupsDisabled===true}));
  if(String(url).endsWith('/token'))return new Response(JSON.stringify({access_token:'provider-secret-token',token_type:'Bearer',scope:opts.noScope?'ACTIVITY:READ':'SETTINGS:READ'}),{status:opts.tokenStatus||200});
  return new Response(JSON.stringify({id:opts.athleteId||'athlete-1',email:opts.email===undefined?'rider@example.com':opts.email,icu_email_verified:opts.verified===undefined?true:opts.verified,private_profile:'never-return'}),{status:opts.profileStatus||200});
 });
 runInNewContext(compiled,{createClient:(url,key)=>{clients.push(key);return key==='service-role-secret'?db:isolated;},crypto:webcrypto,TextEncoder,Uint8Array,URL,URLSearchParams,Request,Response,AbortSignal,Date,btoa,fetch,Deno:{env:{get:name=>({SUPABASE_URL:'https://database.example',SUPABASE_SERVICE_ROLE_KEY:'service-role-secret',SUPABASE_ANON_KEY:'public-anon-key',MAINTENANCE_APP_ORIGINS:origin,INTERVALS_LOGIN_REDIRECT_URIS:redirect})[name]},serve:fn=>{handler=fn;}}});
 const request=(body,{auth,requestOrigin=origin,method='POST'}={})=>handler(new Request('https://function.example',{method,headers:{Origin:requestOrigin,...(auth?{Authorization:'Bearer '+auth}:{}),'Content-Type':'application/json'},...(method==='OPTIONS'||method==='GET'?{}:{body:JSON.stringify(body)})}));
 const start=async(mode='signin',auth,extra={})=>{
  const response=await request({action:'start',mode,proof,redirectUri:redirect,rememberMe:false,...extra},{auth});
  const body=await response.clone().json();return{response,body};
 };
 const complete=async(state,extra={},auth)=>request({action:'complete',mode:'signin',state,proof,code:'fresh-code',...extra},{auth});
 return{request,start,complete,users,identities,pending,connections,calls,db,isolated,clients,fetch};
}
it('uses server-held PKCE, fixed client 2006 and a browser proof; never returns its verifier',async()=>{
 const app=setup();const {response,body}=await app.start('signin',undefined,{rememberMe:true,userId:'u2',clientId:'attacker'});
 expect(response.status).toBe(200);const url=new URL(body.authorizationUrl);
 expect(url.searchParams.get('client_id')).toBe('2006');expect(url.searchParams.get('scope')).toBe('SETTINGS:READ');expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('redirect_uri')).toBe(redirect);
 const tx=app.calls.find(c=>c.rpc==='start_maintenance_intervals_login').args;
 expect(tx.p_owner_id).toBeNull();expect(tx.p_remember_me).toBe(true);expect(tx.p_ip_hash).toMatch(/^[a-f0-9]{64}$/);
 expect(tx.p_state_hash).not.toBe(body.state);expect(tx.p_proof_hash).not.toBe(proof);
 expect(url.searchParams.get('code_challenge')).toBe(Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(tx.p_verifier))).toString('base64url'));
 expect(JSON.stringify(body)).not.toContain(tx.p_verifier);expect(JSON.stringify(body)).not.toContain(proof);
 expect(app.fetch).not.toHaveBeenCalled();
});
it('automatically links only a provider-verified email to a confirmed existing account and creates an ordinary Supabase session',async()=>{
 const app=setup();const {body}=await app.start('signin',undefined,{rememberMe:true});const response=await app.complete(body.state,{email:'other@example.com',userId:'u2',athleteId:'forged'});
 const result=await response.json();expect(response.status).toBe(200);expect(result.session.user).toEqual({id:'u1',email:'rider@example.com'});expect(result.rememberMe).toBe(true);expect(app.identities.get('athlete-1')).toBe('u1');
 expect(app.db.auth.admin.generateLink).toHaveBeenCalledWith({type:'magiclink',email:'rider@example.com'});
 expect(app.isolated.auth.verifyOtp).toHaveBeenCalledWith({token_hash:'private-one-time-hash',type:'magiclink'});
 expect(app.db.auth.verifyOtp).not.toHaveBeenCalled();expect(app.clients).toEqual(['service-role-secret','public-anon-key']);
 expect(JSON.stringify(result)).not.toMatch(/provider-secret|private-one-time-hash|never-return|service-role-secret/);
 expect(app.db.auth.admin.createUser).not.toHaveBeenCalled();expect(app.connections.size).toBe(1);expect([...app.connections.values()][0].access_token).toBe('provider-secret-token');
});
it('creates an email-capable account for a new verified provider email without sending email, enabling login and mileage together',async()=>{
 const app=setup({email:'New.Rider@example.com'});const {body}=await app.start();const response=await app.complete(body.state);
 expect(response.status).toBe(200);expect((await response.json()).session.user.id).toBe('new-user');
 expect(app.db.auth.admin.createUser).toHaveBeenCalledWith({email:'new.rider@example.com',email_confirm:true});
 expect(app.identities.get('athlete-1')).toBe('new-user');expect(app.connections.size).toBe(1);expect([...app.connections.values()][0].access_token).toBe('provider-secret-token');
});
it.each([false,'true',null])('does not auto-link an unverified/missing verification flag (%s)',async verified=>{
 const app=setup({verified});const{body}=await app.start();const response=await app.complete(body.state);
 expect(response.status).toBe(409);expect((await response.json()).code).toBe('INTERVALS_EMAIL_VERIFICATION_REQUIRED');expect(app.identities.size).toBe(0);expect(app.db.auth.admin.generateLink).not.toHaveBeenCalled();
});
it('does not confirm or take over an existing unverified Supabase email account',async()=>{
 const app=setup({unconfirmed:true});const{body}=await app.start();expect((await app.complete(body.state)).status).toBe(409);expect(app.db.auth.admin.createUser).not.toHaveBeenCalled();expect(app.identities.size).toBe(0);
});
it('uses the stable athlete mapping even after its provider email changes to another user’s address or becomes unverified',async()=>{
 for(const verified of [true,false]){const app=setup({linked:true,email:'other@example.com',verified});const{body}=await app.start();const response=await app.complete(body.state);expect(response.status).toBe(200);expect((await response.json()).session.user.id).toBe('u1');expect(app.identities.get('athlete-1')).toBe('u1');}
});
it('rejects an ambiguous confirmed-email match',async()=>{
 const app=setup({ambiguous:true});const{body}=await app.start();const response=await app.complete(body.state);expect(response.status).toBe(409);expect(app.db.auth.admin.generateLink).not.toHaveBeenCalled();
});
it('rejects linking an athlete or account that already has a different link',async()=>{
 const app=setup({linked:true});const{body}=await app.start('link','session-u2');const response=await app.complete(body.state,{mode:'link'},'session-u2');expect(response.status).toBe(409);expect(app.identities.get('athlete-1')).toBe('u1');
 const second=setup({linked:true,athleteId:'athlete-2'});const{body:other}=await second.start();expect((await second.complete(other.state)).status).toBe(409);expect(second.identities.has('athlete-2')).toBe(false);
});
it('allows explicit linking to the authenticated account without trusting the provider email and never issues another session',async()=>{
 const app=setup({email:'unverified@example.com',verified:false});const{body}=await app.start('link','session-u1',{userId:'u2'});const response=await app.complete(body.state,{mode:'link'},'session-u1');expect(await response.json()).toEqual({linked:true});expect(app.identities.get('athlete-1')).toBe('u1');expect(app.db.auth.admin.generateLink).not.toHaveBeenCalled();
});
it('requires a current matching Supabase identity for linking, and does not consume transactions on an expired JWT',async()=>{
 const app=setup();expect((await app.start('link')).response.status).toBe(401);const{body}=await app.start('link','session-u1');
 expect((await app.complete(body.state,{mode:'link'},'expired')).status).toBe(401);expect(app.pending.size).toBe(1);
 expect((await app.complete(body.state,{mode:'link'},'session-u2')).status).toBe(409);expect(app.fetch).not.toHaveBeenCalled();
});
it('requires the private browser proof, consumes a valid request once, and does not accept access tokens as login credentials',async()=>{
 const app=setup();const{body}=await app.start();expect((await app.complete(body.state,{proof:'Q'.repeat(43)})).status).toBe(400);expect(app.pending.size).toBe(1);
 const invalid=await app.complete(body.state,{code:undefined,accessToken:'provider-secret-token'});expect(invalid.status).toBe(400);expect(app.fetch).not.toHaveBeenCalled();expect(app.pending.size).toBe(0);
 const next=await app.start();expect((await app.complete(next.body.state)).status).toBe(200);expect((await app.complete(next.body.state)).status).toBe(400);expect(app.db.auth.admin.generateLink).toHaveBeenCalledTimes(1);
});
it('uses the stored verifier and registered redirect at the fixed provider token endpoint, ignoring caller overrides',async()=>{
 const app=setup();const{body}=await app.start();await app.complete(body.state,{verifier:'attacker',redirectUri:'https://attacker.example',clientId:'bad'});
 const [url,options]=app.fetch.mock.calls[0];const form=new URLSearchParams(options.body);expect(url).toBe('https://intervals.icu/api/oauth/token');expect(form.get('client_id')).toBe('2006');expect(form.get('redirect_uri')).toBe(redirect);expect(form.get('code_verifier')).toBe(app.calls.find(c=>c.rpc==='start_maintenance_intervals_login').args.p_verifier);expect(form.has('client_secret')).toBe(false);expect(options.credentials).toBe('omit');expect(options.redirect).toBe('error');
 expect(app.fetch.mock.calls[1][0]).toBe('https://intervals.icu/api/v1/athlete/0');expect(app.fetch.mock.calls.some(([url])=>url.endsWith('/gear'))).toBe(false);
});
it('handles denial and expiration without linking or generating sessions',async()=>{
 const app=setup();const{body}=await app.start();expect((await app.complete(body.state,{denied:true})).status).toBe(400);expect(app.fetch).not.toHaveBeenCalled();expect(app.pending.size).toBe(0);
 const expired=setup({expired:true});const tx=await expired.start();expect((await expired.complete(tx.body.state)).status).toBe(400);expect(expired.fetch).not.toHaveBeenCalled();
});
it('rejects unregistered redirects, untrusted origins, and invalid start requests',async()=>{
 const app=setup();expect((await app.start('signin',undefined,{redirectUri:'https://attacker.example/'})).response.status).toBe(400);
 expect((await app.request({action:'start'},{requestOrigin:'https://evil.example'})).status).toBe(403);expect((await app.start('signin',undefined,{proof:'short'})).response.status).toBe(400);expect(app.calls).toHaveLength(0);
 expect((await app.request(null,{method:'OPTIONS'})).status).toBe(204);expect((await app.request(null,{method:'GET'})).status).toBe(405);
});
it.each([{tokenStatus:400},{tokenStatus:500},{profileStatus:401},{offline:true},{noScope:true}])('does not map or issue a session when provider verification fails (%s)',async opts=>{
 const app=setup(opts);const{body}=await app.start();const response=await app.complete(body.state);expect(response.status).toBeGreaterThanOrEqual(400);expect(app.identities.size).toBe(0);expect(app.db.auth.admin.generateLink).not.toHaveBeenCalled();expect(await response.text()).not.toContain('provider-secret');
});
it('discards and revokes a wrongly addressed Supabase session rather than returning access to another user',async()=>{
 const app=setup({wrongSession:true});const{body}=await app.start();const response=await app.complete(body.state);expect(response.status).toBe(503);expect(app.isolated.auth.signOut).toHaveBeenCalledWith({scope:'local'});expect(await response.text()).not.toContain('supabase-access');
});
it('enables mileage on fresh login, including replacing a different old credential with the proven athlete',async()=>{
 for(const opts of [{},{mileage:true},{mileage:true,otherMileage:true}]){const app=setup(opts);const{body}=await app.start();expect((await app.complete(body.state)).status).toBe(200);expect(app.connections.get('u1')).toEqual({athlete_id:'athlete-1',access_token:'provider-secret-token'});}
});
it('does not expose a separate unlink-login operation',async()=>{
 const app=setup({linked:true,mileage:true});expect((await app.request({action:'unlink'},{auth:'session-u1'})).status).toBe(400);expect(app.identities.size).toBe(1);expect(app.connections.has('u1')).toBe(true);
});
it('does not issue a session or partially link when the atomic connection save fails',async()=>{
 const app=setup({saveFails:true});const{body}=await app.start();expect((await app.complete(body.state)).status).toBe(503);expect(app.identities.size).toBe(0);expect(app.connections.size).toBe(0);expect(app.db.auth.admin.generateLink).not.toHaveBeenCalled();
});
it('returns sanitized pending-request limits instead of raw SQL or credential details',async()=>{
 const app=setup({dbError:'P0002'});const response=(await app.start()).response;expect(response.status).toBe(429);expect(await response.text()).not.toMatch(/private|service-role/);
});

it('respects disabled Supabase signups instead of bypassing them with Admin createUser',async()=>{
 const app=setup({email:'new@example.com',signupsDisabled:true});const{body}=await app.start();const response=await app.complete(body.state);expect(response.status).toBe(403);expect(app.db.auth.admin.createUser).not.toHaveBeenCalled();expect(app.identities.size).toBe(0);
});

it('rejects banned accounts without saving credentials or issuing a session',async()=>{
 const app=setup({banned:true});const{body}=await app.start();expect((await app.complete(body.state)).status).toBe(403);expect(app.identities.size).toBe(0);expect(app.connections.size).toBe(0);expect(app.db.auth.admin.generateLink).not.toHaveBeenCalled();
});
