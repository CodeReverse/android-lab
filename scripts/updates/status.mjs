import fs from 'node:fs';
import { createHash } from 'node:crypto';
const config=JSON.parse(fs.readFileSync('content/update-config.json','utf8'));
const state=JSON.parse(fs.readFileSync('content/updates/state.json','utf8'));
const content=fs.readFileSync('content/generated.json');
const version=createHash('sha256').update(content).digest('hex').slice(0,16);
fs.mkdirSync('public',{recursive:true});
fs.writeFileSync('public/update-status.json',JSON.stringify({version,updated:JSON.parse(content).updated,enabled:config.enabled,scheduleLabel:config.scheduleLabel,lookbackDays:config.lookbackDays,maxDraftsPerRun:config.maxDraftsPerRun,lastRun:state.lastRun,history:state.history,candidates:state.candidates.slice(-100).reverse()},null,2)+'\n');
