const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { codexUsage } = require('./agents.cjs');

test('usage uses only read-only protocol, normalizes quotas, and rejects missing auth', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'branchline-agent-'));
  const executable = path.join(root, 'codex');
  try {
    for (const signedIn of [true, false]) {
      await fs.writeFile(executable, `#!${process.execPath}
const assert = require('node:assert/strict');
require('node:readline').createInterface({input:process.stdin}).on('line', line => {
 const m = JSON.parse(line);
 assert.ok(['initialize','initialized','account/read','account/rateLimits/read'].includes(m.method));
 if (!m.id) return;
 if (m.method === 'account/read') assert.equal(m.params.refreshToken, false);
 const result = m.id === 1 ? {} : m.id === 2 ? {account:${signedIn ? "{type:'chatgpt',email:'test@example.invalid',planType:'pro',secret:'never-expose'}" : 'null'}} : {rateLimitsByLimitId:{codex:{limitName:'Codex',primary:{usedPercent:27,windowDurationMins:300,resetsAt:1234},secondary:null},other:{primary:{usedPercent:110},secondary:{usedPercent:null}}}};
 process.stdout.write(JSON.stringify({id:m.id,result})+'\\n');
});`, { mode: 0o700 });
      if (!signedIn) await assert.rejects(codexUsage(executable), /로그인/);
      else {
        const result = await codexUsage(executable);
        assert.equal(result.windows.length, 2);
        assert.equal(result.windows[0].remainingPercent, 73);
        assert.equal(result.windows[0].windowMinutes, 300);
        assert.equal(result.windows[1].remainingPercent, 0);
        assert.equal(result.windows[1].resetsAt, null);
        assert.equal(JSON.stringify(result).includes('never-expose'), false);
      }
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('all CLI adapters accept only bounded proposals, keep auth external, and cancel without touching a repository', async t => {
  const { chat, promptFor, parseReply } = require('./agent-chat.cjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'branchline-chat-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const snapshot = { file: '한글.txt', token: 'a'.repeat(64), base: 'old', ours: 'two', theirs: 'three', current: 'conflict' };
  const input = { prompt: '둘 다 유지해줘', draft: '내 편집', messages: [{ role: 'user', content: '이전 질문' }], previousResult: '이전 제안' };
  for (const id of ['codex', 'claude', 'gemini']) {
    const executable = path.join(root, id);
    await fs.writeFile(executable, `#!${process.execPath}
const assert = require('node:assert/strict'), fs = require('node:fs');
assert.ok(process.cwd().includes('branchline-agent-'));
assert.equal(process.env.ELECTRON_RUN_AS_NODE, undefined);
const args = process.argv.slice(2);
if (${JSON.stringify(id)} === 'codex') { assert.ok(args.includes('--ignore-user-config')); assert.ok(args.includes('read-only')); assert.ok(args.includes('shell_tool')); assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox')); }
if (${JSON.stringify(id)} === 'claude') { assert.ok(args.includes('--safe-mode')); assert.equal(args[args.indexOf('--tools') + 1], ''); assert.ok(args.includes('--strict-mcp-config')); }
if (${JSON.stringify(id)} === 'gemini') { const settings = JSON.parse(fs.readFileSync('.gemini/settings.json')); assert.deepEqual(settings.tools.core, []); assert.equal(settings.hooksConfig.enabled, false); assert.ok(args.includes('none')); assert.ok(args.includes('--skip-trust')); }
let input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', s => input += s); process.stdin.on('end', () => {
assert.ok(input.includes('둘 다 유지해줘')); assert.ok(input.includes('이전 제안'));
const result = {message:'양쪽 내용을 보존했습니다.',result:'two\\nthree\\n'};
const envelope = ${JSON.stringify(id)} === 'claude' ? {structured_output:result,secret:'do-not-forward'} : ${JSON.stringify(id)} === 'gemini' ? {response:JSON.stringify(result),secret:'do-not-forward'} : result;
process.stdout.write(JSON.stringify(envelope));
});`, { mode: 0o700 });
    const reply = await chat({ id, path: executable }, snapshot, input, new AbortController().signal);
    assert.equal(reply.agent, id); assert.equal(reply.result, 'two\nthree\n'); assert.equal(reply.token, snapshot.token);
    assert.ok(!JSON.stringify(reply).includes('do-not-forward'));
    const commitSnapshot = { kind: 'commit-message', file: 'COMMIT_MESSAGE', token: snapshot.token, originalMessage: '기존 제목', commitDiff: '+committed change', stagedDiff: '+staged change' };
    const commitPrompt = promptFor(commitSnapshot, input);
    assert.match(commitPrompt, /Amend/); assert.match(commitPrompt, /committedChanges/); assert.ok(!commitPrompt.includes('stage2'));
    const commitReply = await chat({ id, path: executable }, commitSnapshot, input, new AbortController().signal);
    assert.equal(commitReply.result, 'two\nthree\n'); assert.equal(commitReply.file, 'COMMIT_MESSAGE');
  }
  assert.throws(() => promptFor(snapshot, { ...input, prompt: '' }), /질문/);
  assert.throws(() => promptFor(snapshot, { ...input, messages: Array(21).fill({ role: 'user', content: 'q' }) }), /10회/);
  assert.throws(() => promptFor(snapshot, { ...input, draft: 'a'.repeat(600000) }), /512 KiB/);
  assert.throws(() => parseReply('codex', '{"message":"ok","result":12}'), /형식/);
  assert.throws(() => parseReply('claude', '{"is_error":true,"result":"secret"}'), e => !e.message.includes('secret'));
  const executable = path.join(root, 'waiting');
  await fs.writeFile(executable, `#!${process.execPath}\nprocess.stdin.resume();setInterval(()=>{},1000);`, { mode: 0o700 });
  const controller = new AbortController();
  const running = chat({ id: 'codex', path: executable }, snapshot, input, controller.signal);
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(running, /중단/);
});
