// Parakeet lives here, off the socket loop. in: {id, samples: Float32Array 16 kHz}  out: {id, text, ms}
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
const sherpa = createRequire(import.meta.url)('sherpa-onnx-node');
const P = `${workerData.modelsDir}/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8`;
const rec = new sherpa.OfflineRecognizer({
	featConfig: { sampleRate: 16000, featureDim: 80 },
	modelConfig: {
		transducer: { encoder: `${P}/encoder.int8.onnx`, decoder: `${P}/decoder.int8.onnx`, joiner: `${P}/joiner.int8.onnx` },
		tokens: `${P}/tokens.txt`,
		modelType: 'nemo_transducer',
		numThreads: Number(workerData.threads || 4),
		provider: 'cpu',
		debug: 0
	},
	decodingMethod: 'greedy_search'
});
parentPort.postMessage({ ready: true });
parentPort.on('message', (m) => {
	const t0 = performance.now();
	try {
		const s = rec.createStream();
		s.acceptWaveform({ samples: m.samples, sampleRate: 16000 });
		rec.decode(s);
		parentPort.postMessage({ id: m.id, text: rec.getResult(s).text.trim(), ms: Math.round(performance.now() - t0) });
	} catch (e) {
		parentPort.postMessage({ id: m.id, text: '', error: String(e), ms: Math.round(performance.now() - t0) });
	}
});
