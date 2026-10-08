// Family ears: the RTL Command Center's ears (rtl-command-center/server/src/ears.ts) for Classroom's call mode.
// The browser streams 16 kHz Int16 PCM over a WebSocket; Silero VAD finds each utterance; Parakeet writes the words.
// Partials ~0.6 s into speech then every 0.4 s, a final 0.6 s after speech stops. No voiceprints (those are RTL people).
// Distance gate kept: an utterance much quieter than the person talking to it, or below -48 dBFS, is dropped as "far".
//   GET /ears/status                 {ready}
//   WS  /ears?token=<Open WebUI JWT>  binary = PCM; text = {"type":"reset"|"abort"}
//       -> ready | start | partial{text} | final{text,ms,secs,level,stop} | dropped{reason,level,text} | end | error
import http from 'node:http';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const sherpa = createRequire(import.meta.url)('sherpa-onnx-node');
const MODELS = process.env.EARS_MODELS || '/models';
const PORT = Number(process.env.EARS_PORT || 8132);
const WEBUI = process.env.WEBUI_URL || 'http://127.0.0.1:3000';
const SR = 16000, WIN = 512;
const FAR_DB = Number(process.env.EARS_FAR_DB || 12);
const FLOOR_DB = Number(process.env.EARS_FLOOR_DB || -48);
// Same phrase list as the RTL panel: a stop phrase ends the reply and is never sent as a question.
const STOP_WORDS = /(^|\b)(stop|wait|hold on|cancel|never ?mind|enough|that'?s (enough|fine|good|all)|shut up|(you )?(don'?t|do not) (have to|need to) (keep|continue|go on|carry on|look)|(i )?don'?t need (you to )?(keep|continue)|no need to (keep|continue|go on)|you can stop|okay,? stop|stop there|that'?ll do)\b/i;
const isStop = (t) => { const w = String(t ?? '').trim(); return !!w && STOP_WORDS.test(w) && w.split(/\s+/).length <= 12 && !/\?$/.test(w); };
const dbfs = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return 20 * Math.log10(Math.sqrt(s / Math.max(1, x.length)) + 1e-9); };
const concat = (parts, len) => { const out = new Float32Array(len); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const log = (m) => console.log(new Date().toISOString(), m);

let ready = false, seq = 0;
const pending = new Map();
const worker = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { modelsDir: MODELS, threads: Number(process.env.EARS_THREADS || 4) } });
worker.on('message', (m) => { if (m.ready) { ready = true; log('ears: Parakeet ready'); return; } const cb = pending.get(m.id); if (cb) { pending.delete(m.id); cb(m); } });
worker.on('error', (e) => { ready = false; log(`ears: worker error ${e}`); });
worker.on('exit', (c) => { log(`ears: worker exited ${c}`); process.exit(1); });
const ask = (samples) => new Promise((res) => { if (!ready) return res({ text: '', ms: 0 }); const id = ++seq; pending.set(id, res); worker.postMessage({ id, samples }); });

// Who is calling: the Open WebUI session token, checked against Open WebUI itself.
const whoIs = async (token) => {
	if (!token) return null;
	try {
		const r = await fetch(`${WEBUI}/api/v1/auths/`, { headers: { Authorization: `Bearer ${token}` } });
		if (!r.ok) return null;
		const u = await r.json();
		return u.role === 'pending' ? null : u.name || u.email || u.id;
	} catch { return null; }
};

const server = http.createServer((req, res) => {
	if (req.url.startsWith('/ears/status')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ready })); return; }
	res.statusCode = 404; res.end();
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 1 << 20 });
server.on('upgrade', async (req, sock, head) => {
	const url = new URL(req.url, 'http://x');
	if (url.pathname !== '/ears') { sock.destroy(); return; }
	const who = await whoIs(url.searchParams.get('token'));
	if (!who) { sock.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); sock.destroy(); return; }
	wss.handleUpgrade(req, sock, head, (ws) => session(ws, who));
});

function session(socket, who) {
	const send = (o) => { if (socket.readyState === 1) socket.send(JSON.stringify(o)); };
	if (!ready) { send({ type: 'error', message: 'ears not ready' }); socket.close(4503, 'ears not ready'); return; }
	const vad = new sherpa.Vad({ sileroVad: { model: path.join(MODELS, 'silero_vad.onnx'), threshold: 0.5, minSilenceDuration: 0.6, minSpeechDuration: 0.2, windowSize: WIN, maxSpeechDuration: 20 }, sampleRate: SR, numThreads: 1 }, 40);
	let carry = new Float32Array(0), speaking = false, speech = [], speechLen = 0, lastPartial = 0, partialBusy = false, closed = false;
	const preroll = []; let prerollLen = 0;
	let ref = null; // level of the person who has been talking to it
	const judge = (level) => (level < FLOOR_DB || (ref !== null && level < ref - FAR_DB) ? 'far' : null);
	const finalize = async (samples) => {
		if (samples.length < SR * 0.25) { send({ type: 'end' }); return; }
		const level = dbfs(samples);
		const r = await ask(samples);
		const why = judge(level), secs = +(samples.length / SR).toFixed(2), stop = isStop(r.text);
		log(`ears: ${who} ${why ? 'DROP ' + why : stop ? 'keep (stop word)' : 'keep'} level=${level.toFixed(1)} ref=${ref === null ? '-' : ref.toFixed(1)} ${secs}s ${r.ms}ms ${JSON.stringify(r.text)}`);
		if (why) send({ type: 'dropped', reason: why, level: +level.toFixed(1), text: r.text });
		else {
			if (!stop && r.text) ref = ref === null ? level : 0.7 * ref + 0.3 * level;
			send({ type: 'final', text: r.text, ms: r.ms, secs, level: +level.toFixed(1), stop });
		}
		send({ type: 'end' });
	};
	const drain = async () => { while (!vad.isEmpty()) { const seg = vad.front(); vad.pop(); speaking = false; speech = []; speechLen = 0; await finalize(Float32Array.from(seg.samples)); } };
	socket.on('message', async (data, isBinary) => {
		if (closed) return;
		if (!isBinary) {
			let m = {}; try { m = JSON.parse(String(data)); } catch { return; }
			if (m.type === 'abort' || m.type === 'reset') { vad.reset(); speaking = false; speech = []; speechLen = 0; send({ type: 'end' }); }
			return;
		}
		const i16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength >> 1);
		const f = new Float32Array(carry.length + i16.length); f.set(carry); for (let i = 0; i < i16.length; i++) f[carry.length + i] = i16[i] / 32768;
		let o = 0;
		for (; o + WIN <= f.length; o += WIN) {
			const w = f.subarray(o, o + WIN);
			vad.acceptWaveform(w);
			if (!speaking && vad.isDetected()) { speaking = true; speech = preroll.slice(); speechLen = prerollLen; lastPartial = Date.now(); send({ type: 'start', level: +dbfs(w).toFixed(1) }); }
			if (speaking) { speech.push(Float32Array.from(w)); speechLen += WIN; }
			preroll.push(Float32Array.from(w)); prerollLen += WIN; while (prerollLen > SR * 0.3 && preroll.length > 1) prerollLen -= preroll.shift().length;
		}
		carry = Float32Array.from(f.subarray(o));
		if (!vad.isEmpty()) await drain();
		else if (speaking && !partialBusy && Date.now() - lastPartial > 400 && speechLen >= SR * 0.5) {
			partialBusy = true; lastPartial = Date.now();
			const s = concat(speech, speechLen); const tail = s.length > SR * 8 ? s.subarray(s.length - SR * 8) : s;
			const level = dbfs(tail);
			ask(tail).then((r) => { partialBusy = false; if (!speaking || judge(level)) return; if (r.text) send({ type: 'partial', text: r.text }); });
		}
	});
	socket.on('close', () => { closed = true; });
	send({ type: 'ready' });
}

server.listen(PORT, '127.0.0.1', () => log(`family ears on 127.0.0.1:${PORT}, models ${MODELS}`));
