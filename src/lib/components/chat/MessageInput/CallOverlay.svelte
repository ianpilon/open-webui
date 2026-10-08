<script lang="ts">
	import { config, models, settings, showCallOverlay, TTSWorker } from '$lib/stores';
	import { onMount, tick, getContext, onDestroy, createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	import { blobToFile } from '$lib/utils';
	import { generateEmoji } from '$lib/apis';
	import { synthesizeOpenAISpeech, transcribeAudio } from '$lib/apis/audio';

	import { toast } from 'svelte-sonner';

	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import VideoInputMenu from './CallOverlay/VideoInputMenu.svelte';
	import { KokoroWorker } from '$lib/workers/KokoroWorker';
	import { WEBUI_API_BASE_URL, AUDIO_API_BASE_URL } from '$lib/constants';

	const i18n = getContext('i18n');

	export let eventTarget: EventTarget;
	export let submitPrompt: Function;
	export let stopResponse: Function;
	export let files;
	export let chatId;
	export let modelId;

	let wakeLock = null;

	let model = null;

	let loading = false;
	let confirmed = false;
	let interrupted = false;
	let assistantSpeaking = false;
	let muted = false;

	let emoji = null;
	let camera = false;
	let cameraStream = null;

	let chatStreaming = false;
	let rmsLevel = 0;
	let hasStartedSpeaking = false;
	let mediaRecorder;
	let audioStream = null;
	let audioChunks = [];

	let videoInputDevices = [];
	let selectedVideoInputDeviceId = null;

	const getVideoInputDevices = async () => {
		const devices = await navigator.mediaDevices.enumerateDevices();
		videoInputDevices = devices.filter((device) => device.kind === 'videoinput');

		if (!!navigator.mediaDevices.getDisplayMedia) {
			videoInputDevices = [
				...videoInputDevices,
				{
					deviceId: 'screen',
					label: 'Screen Share'
				}
			];
		}

		console.log(videoInputDevices);
		if (selectedVideoInputDeviceId === null && videoInputDevices.length > 0) {
			const savedDeviceId = localStorage.getItem('selectedVideoInputDeviceId');
			if (savedDeviceId && videoInputDevices.some((d) => d.deviceId === savedDeviceId)) {
				selectedVideoInputDeviceId = savedDeviceId;
			} else {
				selectedVideoInputDeviceId = videoInputDevices[0].deviceId;
			}
		}
	};

	const startCamera = async () => {
		await getVideoInputDevices();

		if (cameraStream === null) {
			camera = true;
			await tick();
			try {
				await startVideoStream();
			} catch (err) {
				console.error('Error accessing webcam: ', err);
			}
		}
	};

	const startVideoStream = async () => {
		const video = document.getElementById('camera-feed');
		if (video) {
			if (selectedVideoInputDeviceId === 'screen') {
				cameraStream = await navigator.mediaDevices.getDisplayMedia({
					video: {
						cursor: 'always'
					},
					audio: false
				});
			} else {
				cameraStream = await navigator.mediaDevices.getUserMedia({
					video: {
						deviceId: selectedVideoInputDeviceId ? { exact: selectedVideoInputDeviceId } : undefined
					}
				});
			}

			if (cameraStream) {
				await getVideoInputDevices();
				video.srcObject = cameraStream;
				await video.play();
			}
		}
	};

	const stopVideoStream = async () => {
		if (cameraStream) {
			const tracks = cameraStream.getTracks();
			tracks.forEach((track) => track.stop());
		}

		cameraStream = null;
	};

	const takeScreenshot = () => {
		const video = document.getElementById('camera-feed');
		const canvas = document.getElementById('camera-canvas');

		if (!canvas) {
			return;
		}

		const context = canvas.getContext('2d');

		// Make the canvas match the video dimensions
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		// Draw the image from the video onto the canvas
		context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

		// Convert the canvas to a data base64 URL and console log it
		const dataURL = canvas.toDataURL('image/png');
		console.log(dataURL);

		return dataURL;
	};

	const stopCamera = async () => {
		await stopVideoStream();
		camera = false;
	};

	const MIN_DECIBELS = -55;
	const VISUALIZER_BUFFER_LENGTH = 300;

	const transcribeHandler = async (audioBlob) => {
		// Create a blob from the audio chunks
		if (!audioBlob || audioBlob.size < 100) {
			console.log('Audio blob too small or empty, skipping transcription');
			return;
		}

		await tick();
		const file = blobToFile(audioBlob, 'recording.wav');

		const res = await transcribeAudio(
			localStorage.token,
			file,
			$settings?.audio?.stt?.language
		).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			console.log(res.text);

			if (res.text !== '') {
				const _responses = await submitPrompt(res.text, { _raw: true });
				console.log(_responses);
			}
		}
	};

	const stopRecordingCallback = async (_continue = true) => {
		if ($showCallOverlay) {
			console.log('%c%s', 'color: red; font-size: 20px;', '🚨 stopRecordingCallback 🚨');

			// deep copy the audioChunks array
			const _audioChunks = audioChunks.slice(0);

			audioChunks = [];
			mediaRecorder = false;

			if (_continue) {
				startRecording();
			}

			if (confirmed) {
				loading = true;
				emoji = null;

				if (cameraStream) {
					const imageUrl = takeScreenshot();

					files = [
						{
							type: 'image',
							url: imageUrl
						}
					];
				}

				const audioBlob = new Blob(_audioChunks, { type: 'audio/wav' });
				await transcribeHandler(audioBlob);

				confirmed = false;
				loading = false;
			}
		} else {
			audioChunks = [];
			mediaRecorder = false;

			if (audioStream) {
				const tracks = audioStream.getTracks();
				tracks.forEach((track) => track.stop());
			}
			audioStream = null;
		}
	};

	// Pilon family fork: the RTL Command Center's ears. The mic streams 16 kHz PCM to family-ears on the head
	// (/ears, same host), where Silero VAD finds real speech and Parakeet writes the words. Noise, a far voice
	// or the TV no longer counts as the user talking, so replies are not cut by every sound. The reply stops
	// only when the user actually says words (a partial of 2+ words) or a stop phrase ("stop", "wait", ...).
	// If the ears cannot be reached, the call falls back to upstream's recorder below.
	let earsWs: WebSocket | null = null;
	let earsContext: AudioContext | null = null;
	let earsNode: ScriptProcessorNode | null = null;
	const BACKCHANNEL = /^(mm+|mhm|uh[- ]?huh|uh|um|hmm+|ok(ay)?|yeah|yes|right|sure)[.!]?$/i;

	const startEars = async () => {
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				// no auto gain: a voice in the next room stays quiet, so the server can tell it is far
				audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
			});
		} catch (e) {
			return false;
		}
		const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
		const ws = new WebSocket(`${proto}${location.host}/ears?token=${encodeURIComponent(localStorage.token)}`);
		ws.binaryType = 'arraybuffer';
		const ok = await new Promise((resolve) => {
			const timer = setTimeout(() => resolve(false), 4000);
			ws.onmessage = (ev) => {
				try {
					if (JSON.parse(ev.data).type === 'ready') {
						clearTimeout(timer);
						resolve(true);
					}
				} catch {}
			};
			ws.onerror = () => {
				clearTimeout(timer);
				resolve(false);
			};
		});
		if (!ok || !$showCallOverlay) {
			ws.close();
			stream.getTracks().forEach((t) => t.stop());
			return false;
		}

		audioStream = stream;
		earsWs = ws;
		earsContext = new AudioContext();
		const source = earsContext.createMediaStreamSource(stream);
		earsNode = earsContext.createScriptProcessor(4096, 1, 1);
		const sink = earsContext.createGain();
		sink.gain.value = 0;
		const ratio = earsContext.sampleRate / 16000;
		earsNode.onaudioprocess = (e) => {
			const x = e.inputBuffer.getChannelData(0);
			let sum = 0;
			for (let i = 0; i < x.length; i++) sum += x[i] * x[i];
			rmsLevel = muted ? 0 : Math.sqrt(sum / x.length);
			if (muted || ws.readyState !== 1) return;
			const n = Math.floor(x.length / ratio);
			const out = new Int16Array(n);
			for (let i = 0; i < n; i++) {
				const p = i * ratio,
					j = Math.floor(p),
					a = p - j;
				const v = x[j] + ((x[j + 1] ?? x[j]) - x[j]) * a;
				out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
			}
			ws.send(out.buffer);
		};
		source.connect(earsNode);
		earsNode.connect(sink);
		sink.connect(earsContext.destination);

		ws.onmessage = async (ev) => {
			let m: any = {};
			try {
				m = JSON.parse(ev.data);
			} catch {
				return;
			}
			if (muted) return;
			const replying = assistantSpeaking || chatStreaming;
			if (m.type === 'start') {
				hasStartedSpeaking = true;
			} else if (m.type === 'end' || m.type === 'dropped') {
				hasStartedSpeaking = false;
			} else if (m.type === 'partial') {
				const words = String(m.text || '').trim();
				if (replying && words.split(/\s+/).length >= 2 && !BACKCHANNEL.test(words)) stopAllAudio();
			} else if (m.type === 'final') {
				const text = String(m.text || '').trim();
				if (m.stop) {
					stopAllAudio();
					return;
				}
				if (!text || (replying && BACKCHANNEL.test(text))) return;
				if (replying) await stopAllAudio();
				loading = true;
				emoji = null;
				if (cameraStream) files = [{ type: 'image', url: takeScreenshot() }];
				await submitPrompt(text, { _raw: true });
				loading = false;
			}
		};
		ws.onclose = () => {
			if (earsWs !== ws) return;
			earsWs = null;
			stopEars();
			// the ears went away mid-call: reconnect (or fall back to the recorder)
			if ($showCallOverlay) setTimeout(() => startRecording(), 1000);
		};
		return true;
	};

	const stopEars = () => {
		const ws = earsWs;
		earsWs = null;
		try {
			ws?.close();
		} catch {}
		earsNode?.disconnect();
		earsNode = null;
		earsContext?.close().catch(() => {});
		earsContext = null;
		audioStream?.getTracks().forEach((t) => t.stop());
		audioStream = null;
	};

	const startRecording = async () => {
		if ($showCallOverlay) {
			if (!earsWs && !audioStream && (await startEars())) return;
			if (earsWs) return;
			if (!audioStream) {
				audioStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true
					}
				});
			}

			if (audioStream) {
				// hardware track muting disabled to prevent backend translation errors with malformed WebM files
			}

			mediaRecorder = new MediaRecorder(audioStream);

			mediaRecorder.onstart = () => {
				console.log('Recording started');
				audioChunks = [];
			};

			mediaRecorder.ondataavailable = (event) => {
				if (hasStartedSpeaking) {
					audioChunks.push(event.data);
				}
			};

			mediaRecorder.onstop = (e) => {
				console.log('Recording stopped', audioStream, e);
				stopRecordingCallback();
			};

			analyseAudio(audioStream);
		}
	};

	const stopAudioStream = async () => {
		if (earsWs) {
			stopEars();
			return;
		}
		try {
			if (mediaRecorder) {
				mediaRecorder.stop();
			}
		} catch (error) {
			console.log('Error stopping audio stream:', error);
		}

		if (!audioStream) return;

		audioStream.getAudioTracks().forEach(function (track) {
			track.stop();
		});

		audioStream = null;
	};

	// Function to calculate the RMS level from time domain data
	const calculateRMS = (data: Uint8Array) => {
		let sumSquares = 0;
		for (let i = 0; i < data.length; i++) {
			const normalizedValue = (data[i] - 128) / 128; // Normalize the data
			sumSquares += normalizedValue * normalizedValue;
		}
		return Math.sqrt(sumSquares / data.length);
	};

	const analyseAudio = (stream) => {
		const audioContext = new AudioContext();
		const audioStreamSource = audioContext.createMediaStreamSource(stream);

		const analyser = audioContext.createAnalyser();
		analyser.minDecibels = MIN_DECIBELS;
		audioStreamSource.connect(analyser);

		const bufferLength = analyser.frequencyBinCount;

		const domainData = new Uint8Array(bufferLength);
		const timeDomainData = new Uint8Array(analyser.fftSize);

		let lastSoundTime = Date.now();
		hasStartedSpeaking = false;

		console.log('🔊 Sound detection started', lastSoundTime, hasStartedSpeaking);

		const detectSound = () => {
			const processFrame = () => {
				if (!mediaRecorder || !$showCallOverlay) {
					return;
				}

				if (muted || (assistantSpeaking && !($settings?.voiceInterruption ?? false))) {
					// Suppress mic input when muted or when assistant is speaking without interruption enabled
					analyser.maxDecibels = 0;
					analyser.minDecibels = -1;
				} else {
					analyser.minDecibels = MIN_DECIBELS;
					analyser.maxDecibels = -30;
				}

				analyser.getByteTimeDomainData(timeDomainData);
				analyser.getByteFrequencyData(domainData);

				// Calculate RMS level from time domain data
				rmsLevel = calculateRMS(timeDomainData);

				if (muted || (assistantSpeaking && !($settings?.voiceInterruption ?? false))) {
					rmsLevel = 0;
				}

				// Check if initial speech/noise has started
				const hasSound = domainData.some((value) => value > 0);
				if (hasSound) {
					// BIG RED TEXT
					console.log('%c%s', 'color: red; font-size: 20px;', '🔊 Sound detected');
					if (mediaRecorder && mediaRecorder.state !== 'recording') {
						mediaRecorder.start();
					}

					if (!hasStartedSpeaking) {
						hasStartedSpeaking = true;
						stopAllAudio();
					}

					lastSoundTime = Date.now();
				}

				// Start silence detection only after initial speech/noise has been detected
				if (hasStartedSpeaking) {
					if (Date.now() - lastSoundTime > 2000) {
						confirmed = true;

						if (mediaRecorder) {
							console.log('%c%s', 'color: red; font-size: 20px;', '🔇 Silence detected');
							mediaRecorder.stop();
							return;
						}
					}
				}

				window.requestAnimationFrame(processFrame);
			};

			window.requestAnimationFrame(processFrame);
		};

		detectSound();
	};

	let finishedMessages = {};
	let currentMessageId = null;
	let currentUtterance: SpeechSynthesisUtterance | null = null;

	// Get voice: model-specific > user settings > config default
	const getVoiceId = () => {
		// Check for model-specific TTS voice first
		if (model?.info?.meta?.tts?.voice) {
			return model.info.meta.tts.voice;
		}
		// Fall back to user settings or config default
		if ($settings?.audio?.tts?.defaultVoice === $config.audio.tts.voice) {
			return $settings?.audio?.tts?.voice ?? $config?.audio?.tts?.voice;
		}
		return $config?.audio?.tts?.voice;
	};

	const speakSpeechSynthesisHandler = (content) => {
		if ($showCallOverlay) {
			return new Promise((resolve) => {
				let voices = [];
				const getVoicesLoop = setInterval(async () => {
					voices = await speechSynthesis.getVoices();
					if (voices.length > 0) {
						clearInterval(getVoicesLoop);

						const voiceId = getVoiceId();
						const voice = voices?.filter((v) => v.voiceURI === voiceId)?.at(0) ?? undefined;

						currentUtterance = new SpeechSynthesisUtterance(content);
						currentUtterance.rate = $settings.audio?.tts?.playbackRate ?? 1;

						if (voice) {
							currentUtterance.voice = voice;
						}

						speechSynthesis.speak(currentUtterance);
						currentUtterance.onend = async (e) => {
							await new Promise((r) => setTimeout(r, 200));
							resolve(e);
						};
					}
				}, 100);
			});
		} else {
			return Promise.resolve();
		}
	};

	const playAudio = (audio: HTMLAudioElement) => {
		if ($showCallOverlay) {
			return new Promise((resolve) => {
				const audioElement = document.getElementById('audioElement') as HTMLAudioElement;

				if (!audioElement) {
					resolve(null);
					return;
				}

				let settled = false;
				const finish = async (e: Event | Error | null = null) => {
					if (settled) {
						return;
					}

					settled = true;
					audioElement.onended = null;
					audioElement.onerror = null;
					audioElement.onpause = null;

					await new Promise((r) => setTimeout(r, 100));
					resolve(e);
				};

				audioElement.src = audio.src;
				audioElement.muted = true;
				audioElement.playbackRate = $settings.audio?.tts?.playbackRate ?? 1;
				audioElement.onended = finish;
				audioElement.onerror = () => finish();
				audioElement.onpause = finish;

				audioElement
					.play()
					.then(() => {
						audioElement.muted = false;
					})
					.catch((error) => {
						console.error(error);
						finish(error);
					});
			});
		} else {
			return Promise.resolve();
		}
	};

	// Pilon family fork: streamed voice. /audio/speech/stream returns raw int16 mono PCM as the
	// engine makes it; chunks are scheduled back to back on one AudioContext, so the first words
	// play ~0.6 s after a sentence arrives instead of after the whole clip is synthesized.
	let pcmContext: AudioContext | null = null;
	let pcmSources = new Set<AudioBufferSourceNode>();
	let pcmGeneration = 0;

	const getPcmContext = async () => {
		if (!pcmContext) pcmContext = new AudioContext();
		if (pcmContext.state !== 'running') await pcmContext.resume().catch(() => {});
		return pcmContext.state === 'running' ? pcmContext : null;
	};

	// Starts the request and fills { chunks, done, failed } in the background.
	const fetchPcmStream = async (content) => {
		if (!(await getPcmContext())) return null;
		const res = await fetch(`${AUDIO_API_BASE_URL}/speech/stream`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${localStorage.token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ input: content, voice: getVoiceId() }),
			signal: audioAbortController.signal
		}).catch(() => null);
		if (!res?.ok || !res.body) return null;

		const stream = {
			pcm: true,
			rate: Number(res.headers.get('X-Sample-Rate')) || 24000,
			chunks: [] as Int16Array[],
			done: false
		};
		(async () => {
			const reader = res.body.getReader();
			let carry: Uint8Array | null = null;
			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					let bytes = value;
					if (carry) {
						bytes = new Uint8Array(carry.length + value.length);
						bytes.set(carry);
						bytes.set(value, carry.length);
						carry = null;
					}
					const even = bytes.length - (bytes.length % 2);
					if (even < bytes.length) carry = bytes.slice(even);
					if (even) stream.chunks.push(new Int16Array(bytes.slice(0, even).buffer));
				}
			} catch (e) {
				console.error(e);
			}
			stream.done = true;
		})();
		return stream;
	};

	const playPcmStream = async (stream) => {
		const ctx = await getPcmContext();
		if (!ctx) return;
		const generation = pcmGeneration;
		const rate = $settings.audio?.tts?.playbackRate ?? 1;
		let at = ctx.currentTime + 0.05;
		let next = 0;
		while (generation === pcmGeneration && (!stream.done || next < stream.chunks.length)) {
			if (next >= stream.chunks.length) {
				await new Promise((r) => setTimeout(r, 20));
				continue;
			}
			const samples = stream.chunks[next++];
			const buffer = ctx.createBuffer(1, samples.length, stream.rate);
			const channel = buffer.getChannelData(0);
			for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			source.playbackRate.value = rate;
			source.connect(ctx.destination);
			// A late chunk starts now rather than in the past.
			at = Math.max(at, ctx.currentTime + 0.02);
			source.start(at);
			at += buffer.duration / rate;
			pcmSources.add(source);
			source.onended = () => pcmSources.delete(source);
		}
		// Wait for the scheduled audio to finish playing.
		while (generation === pcmGeneration && ctx.currentTime < at) {
			await new Promise((r) => setTimeout(r, 50));
		}
	};

	const stopAllAudio = async () => {
		assistantSpeaking = false;
		interrupted = true;

		pcmGeneration++;
		for (const source of pcmSources) {
			try {
				source.stop();
			} catch {}
		}
		pcmSources.clear();

		if (chatStreaming) {
			stopResponse();
		}

		if (currentUtterance) {
			speechSynthesis.cancel();
			currentUtterance = null;
		}

		const audioElement = document.getElementById('audioElement') as HTMLAudioElement;
		if (audioElement) {
			audioElement.muted = true;
			audioElement.pause();
			audioElement.currentTime = 0;
		}
	};

	let audioAbortController = new AbortController();

	// Audio cache map where key is the content and value is the Audio object.
	const audioCache = new Map();
	const emojiCache = new Map();

	const fetchAudio = async (content) => {
		let stream = null;
		if (!audioCache.has(content)) {
			try {
				// Set the emoji for the content if needed
				if ($settings?.showEmojiInCall ?? false) {
					const emoji = await generateEmoji(localStorage.token, modelId, content, chatId).catch(
						(error) => {
							console.error(error);
							return null;
						}
					);
					if (emoji) {
						emojiCache.set(content, emoji);
					}
				}

				if ($settings.audio?.tts?.engine === 'browser-kokoro') {
					const url = await $TTSWorker
						.generate({
							text: content,
							voice: getVoiceId()
						})
						.catch((error) => {
							console.error(error);
							toast.error(`${error}`);
						});

					if (url) {
						audioCache.set(content, new Audio(url));
					}
				} else if (
					$config.audio.tts.engine === 'openai' &&
					(stream = await fetchPcmStream(content))
				) {
					audioCache.set(content, stream);
				} else if ($config.audio.tts.engine !== '') {
					const res = await synthesizeOpenAISpeech(localStorage.token, getVoiceId(), content).catch(
						(error) => {
							console.error(error);
							return null;
						}
					);

					if (res) {
						const blob = await res.blob();
						const blobUrl = URL.createObjectURL(blob);
						audioCache.set(content, new Audio(blobUrl));
					}
				} else {
					audioCache.set(content, true);
				}
			} catch (error) {
				console.error('Error synthesizing speech:', error);
			}
		}

		return audioCache.get(content);
	};

	let messages = {};

	const monitorAndPlayAudio = async (id, signal) => {
		while (!signal.aborted) {
			if (messages[id] && messages[id].length > 0) {
				// Retrieve the next content string from the queue
				const content = messages[id].shift(); // Dequeues the content for playing

				if (audioCache.has(content)) {
					// If content is available in the cache, play it

					// Set the emoji for the content if available
					if (($settings?.showEmojiInCall ?? false) && emojiCache.has(content)) {
						emoji = emojiCache.get(content);
					} else {
						emoji = null;
					}

					if ($config.audio.tts.engine !== '') {
						try {
							console.log(
								'%c%s',
								'color: red; font-size: 20px;',
								`Playing audio for content: ${content}`
							);

							const audio = audioCache.get(content);
							if (audio?.pcm) {
								// Pilon family fork: streamed voice; played once, so drop it from the cache.
								audioCache.delete(content);
								await playPcmStream(audio);
							} else {
								await playAudio(audio); // Here ensure that playAudio is indeed correct method to execute
							}
							console.log(`Played audio for content: ${content}`);
							await new Promise((resolve) => setTimeout(resolve, 200)); // Wait before retrying to reduce tight loop
						} catch (error) {
							console.error('Error playing audio:', error);
						}
					} else {
						await speakSpeechSynthesisHandler(content);
					}
				} else {
					// If not available in the cache, push it back to the queue and delay
					messages[id].unshift(content); // Re-queue the content at the start
					console.log(`Audio for "${content}" not yet available in the cache, re-queued...`);
					await new Promise((resolve) => setTimeout(resolve, 200)); // Wait before retrying to reduce tight loop
				}
			} else if (finishedMessages[id] && messages[id] && messages[id].length === 0) {
				// If the message is finished and there are no more messages to process, break the loop
				assistantSpeaking = false;
				break;
			} else {
				// No messages to process, sleep for a bit
				await new Promise((resolve) => setTimeout(resolve, 200));
			}
		}
		console.log(`Audio monitoring and playing stopped for message ID ${id}`);
	};

	const chatStartHandler = async (e) => {
		const { id } = e.detail;

		chatStreaming = true;

		if (currentMessageId !== id) {
			console.log(`Received chat start event for message ID ${id}`);

			currentMessageId = id;
			if (audioAbortController) {
				audioAbortController.abort();
			}
			audioAbortController = new AbortController();

			assistantSpeaking = true;
			// Start monitoring and playing audio for the message ID
			monitorAndPlayAudio(id, audioAbortController.signal);
		}
	};

	const chatEventHandler = async (e) => {
		const { id, content } = e.detail;
		// "id" here is message id
		// if "id" is not the same as "currentMessageId" then do not process
		// "content" here is a sentence from the assistant,
		// there will be many sentences for the same "id"

		if (currentMessageId === id) {
			console.log(`Received chat event for message ID ${id}: ${content}`);

			try {
				if (messages[id] === undefined) {
					messages[id] = [content];
				} else {
					messages[id].push(content);
				}

				console.log(content);

				fetchAudio(content);
			} catch (error) {
				console.error('Failed to fetch or play audio:', error);
			}
		}
	};

	const chatFinishHandler = async (e) => {
		const { id, content } = e.detail;
		// "content" here is the entire message from the assistant
		finishedMessages[id] = true;

		chatStreaming = false;
	};

	const toggleMute = () => {
		muted = !muted;
		if (earsWs) {
			// drop any half-heard sentence; while muted no audio leaves the page
			if (muted) earsWs.send(JSON.stringify({ type: 'abort' }));
			hasStartedSpeaking = false;
			return;
		}
		if (muted && hasStartedSpeaking) {
			// Abort the ongoing recording so it doesn't accidentally send a partial sentence
			hasStartedSpeaking = false;
			confirmed = false;
			audioChunks = [];
			if (mediaRecorder && mediaRecorder.state === 'recording') {
				mediaRecorder.stop();
			}
		}
	};

	let wasAssistantSpeaking = false;
	$: {
		if (assistantSpeaking && !wasAssistantSpeaking) {
			wasAssistantSpeaking = true;
		} else if (!assistantSpeaking && wasAssistantSpeaking) {
			wasAssistantSpeaking = false;
			// Auto unmute when AI finishes speaking (not with the ears: there, mute stays until the user unmutes)
			if (muted && !earsWs) {
				muted = false;
			}
		}
	}

	const handleKeydown = (e: KeyboardEvent) => {
		// Only handle M key when not typing in an input/textarea
		if (e.key === 'm' || e.key === 'M') {
			const target = e.target as HTMLElement;
			if (
				target.tagName !== 'INPUT' &&
				target.tagName !== 'TEXTAREA' &&
				!target.isContentEditable
			) {
				e.preventDefault();
				toggleMute();
			}
		}
	};

	onMount(async () => {
		// Pilon family fork: no default voice; a call needs one picked in Settings > Audio.
		if ($config.audio.tts.engine !== '' && !getVoiceId()) {
			toast.info('Choose a voice first: Settings > Audio > Set Voice');
			showCallOverlay.set(false);
			return;
		}

		const setWakeLock = async () => {
			try {
				wakeLock = await navigator.wakeLock.request('screen');
			} catch (err) {
				// The Wake Lock request has failed - usually system related, such as battery.
				console.log(err);
			}

			if (wakeLock) {
				// Add a listener to release the wake lock when the page is unloaded
				wakeLock.addEventListener('release', () => {
					// the wake lock has been released
					console.log('Wake Lock released');
				});
			}
		};

		if ('wakeLock' in navigator) {
			await setWakeLock();

			document.addEventListener('visibilitychange', async () => {
				// Re-request the wake lock if the document becomes visible
				if (wakeLock !== null && document.visibilityState === 'visible') {
					await setWakeLock();
				}
			});
		}

		model = $models.find((m) => m.id === modelId);

		startRecording();

		eventTarget.addEventListener('chat:start', chatStartHandler);
		eventTarget.addEventListener('chat', chatEventHandler);
		eventTarget.addEventListener('chat:finish', chatFinishHandler);

		document.addEventListener('keydown', handleKeydown);

		return async () => {
			await stopAllAudio();

			stopAudioStream();

			eventTarget.removeEventListener('chat:start', chatStartHandler);
			eventTarget.removeEventListener('chat', chatEventHandler);
			eventTarget.removeEventListener('chat:finish', chatFinishHandler);

			document.removeEventListener('keydown', handleKeydown);

			audioAbortController.abort();
			await tick();

			await stopAllAudio();

			await stopRecordingCallback(false);
			await stopCamera();
		};
	});

	onDestroy(async () => {
		await stopAllAudio();
		await stopRecordingCallback(false);
		await stopCamera();

		await stopAudioStream();
		eventTarget.removeEventListener('chat:start', chatStartHandler);
		eventTarget.removeEventListener('chat', chatEventHandler);
		eventTarget.removeEventListener('chat:finish', chatFinishHandler);

		document.removeEventListener('keydown', handleKeydown);

		audioAbortController.abort();

		await tick();

		await stopAllAudio();
	});
</script>

{#if $showCallOverlay}
	<div class="max-w-lg w-full h-full max-h-[100dvh] flex flex-col justify-between p-3 md:p-6">
		{#if camera}
			<button
				type="button"
				class="flex justify-center items-center w-full h-20 min-h-20"
				on:click={() => {
					if (assistantSpeaking) {
						stopAllAudio();
					}
				}}
			>
				{#if emoji}
					<div
						class="  transition-all rounded-full"
						style="font-size:{rmsLevel * 100 > 4
							? '4.5'
							: rmsLevel * 100 > 2
								? '4.25'
								: rmsLevel * 100 > 1
									? '3.75'
									: '3.5'}rem;width: 100%; text-align:center;"
					>
						{emoji}
					</div>
				{:else if loading || assistantSpeaking}
					<svg
						class="size-12 text-gray-900 dark:text-gray-400"
						viewBox="0 0 24 24"
						fill="currentColor"
						xmlns="http://www.w3.org/2000/svg"
						><style>
							.spinner_qM83 {
								animation: spinner_8HQG 1.05s infinite;
							}
							.spinner_oXPr {
								animation-delay: 0.1s;
							}
							.spinner_ZTLf {
								animation-delay: 0.2s;
							}
							@keyframes spinner_8HQG {
								0%,
								57.14% {
									animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
									transform: translate(0);
								}
								28.57% {
									animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
									transform: translateY(-6px);
								}
								100% {
									transform: translate(0);
								}
							}
						</style><circle class="spinner_qM83" cx="4" cy="12" r="3" /><circle
							class="spinner_qM83 spinner_oXPr"
							cx="12"
							cy="12"
							r="3"
						/><circle class="spinner_qM83 spinner_ZTLf" cx="20" cy="12" r="3" /></svg
					>
				{:else}
					<div
						class=" {rmsLevel * 100 > 4
							? ' size-[4.5rem]'
							: rmsLevel * 100 > 2
								? ' size-16'
								: rmsLevel * 100 > 1
									? 'size-14'
									: 'size-12'}  transition-all rounded-full bg-cover bg-center bg-no-repeat"
						style={`background-image: url('${WEBUI_API_BASE_URL}/models/model/profile/image?id=${model?.id}&lang=${$i18n.language}&voice=true');`}
					/>
				{/if}
				<!-- navbar -->
			</button>
		{/if}

		<div class="flex justify-center items-center flex-1 h-full w-full max-h-full">
			{#if !camera}
				<button
					type="button"
					on:click={() => {
						if (assistantSpeaking) {
							stopAllAudio();
						}
					}}
				>
					{#if emoji}
						<div
							class="  transition-all rounded-full"
							style="font-size:{rmsLevel * 100 > 4
								? '13'
								: rmsLevel * 100 > 2
									? '12'
									: rmsLevel * 100 > 1
										? '11.5'
										: '11'}rem;width:100%;text-align:center;"
						>
							{emoji}
						</div>
					{:else if loading || assistantSpeaking}
						<svg
							class="size-44 text-gray-900 dark:text-gray-400"
							viewBox="0 0 24 24"
							fill="currentColor"
							xmlns="http://www.w3.org/2000/svg"
							><style>
								.spinner_qM83 {
									animation: spinner_8HQG 1.05s infinite;
								}
								.spinner_oXPr {
									animation-delay: 0.1s;
								}
								.spinner_ZTLf {
									animation-delay: 0.2s;
								}
								@keyframes spinner_8HQG {
									0%,
									57.14% {
										animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
										transform: translate(0);
									}
									28.57% {
										animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
										transform: translateY(-6px);
									}
									100% {
										transform: translate(0);
									}
								}
							</style><circle class="spinner_qM83" cx="4" cy="12" r="3" /><circle
								class="spinner_qM83 spinner_oXPr"
								cx="12"
								cy="12"
								r="3"
							/><circle class="spinner_qM83 spinner_ZTLf" cx="20" cy="12" r="3" /></svg
						>
					{:else}
						<div
							class=" {rmsLevel * 100 > 4
								? ' size-52'
								: rmsLevel * 100 > 2
									? 'size-48'
									: rmsLevel * 100 > 1
										? 'size-44'
										: 'size-40'} transition-all rounded-full bg-cover bg-center bg-no-repeat"
							style={`background-image: url('${WEBUI_API_BASE_URL}/models/model/profile/image?id=${model?.id}&lang=${$i18n.language}&voice=true');`}
						/>
					{/if}
				</button>
			{:else}
				<div class="relative flex video-container w-full max-h-full pt-2 pb-4 md:py-6 px-2 h-full">
					<!-- svelte-ignore a11y-media-has-caption -->
					<video
						id="camera-feed"
						autoplay
						class="rounded-2xl h-full min-w-full object-cover object-center"
						playsinline
					/>

					<canvas id="camera-canvas" style="display:none;" />

					<div class=" absolute top-4 md:top-8 left-4">
						<button
							type="button"
							aria-label={$i18n.t('Stop camera')}
							class="p-1.5 text-white cursor-pointer backdrop-blur-xl bg-black/10 rounded-full"
							on:click={() => {
								stopCamera();
							}}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 16 16"
								fill="currentColor"
								class="size-6"
							>
								<path
									d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
								/>
							</svg>
						</button>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-col items-center gap-4 pb-4 w-full">
			<button
				type="button"
				class="z-10"
				on:click={() => {
					if (assistantSpeaking) {
						stopAllAudio();
					}
				}}
			>
				<div class="line-clamp-1 text-sm font-normal">
					{#if loading}
						{$i18n.t('Thinking...')}
					{:else if muted}
						{$i18n.t('Muted')}
					{:else if assistantSpeaking}
						{earsWs ? 'Just talk, or tap here, to interrupt' : $i18n.t('Tap to interrupt')}
					{:else}
						{$i18n.t('Listening...')}
					{/if}
				</div>
			</button>

			<div class="flex items-center justify-center gap-4 z-10">
				{#if camera}
					<VideoInputMenu
						devices={videoInputDevices}
						on:change={async (e) => {
							console.log(e.detail);
							selectedVideoInputDeviceId = e.detail;
							localStorage.setItem('selectedVideoInputDeviceId', e.detail);
							await stopVideoStream();
							await startVideoStream();
						}}
					>
						<button
							aria-label={$i18n.t('Switch camera')}
							class="p-3 rounded-full bg-gray-50 dark:bg-gray-900"
							type="button"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="size-5"
							>
								<path
									fill-rule="evenodd"
									d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</VideoInputMenu>
				{:else}
					<Tooltip content={$i18n.t('Camera')}>
						<button
							aria-label={$i18n.t('Camera')}
							class="p-3 rounded-full bg-gray-50 dark:bg-gray-900"
							type="button"
							on:click={async () => {
								await navigator.mediaDevices.getUserMedia({ video: true });
								startCamera();
							}}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="size-5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
								/>
							</svg>
						</button>
					</Tooltip>
				{/if}

				<Tooltip content={muted ? $i18n.t('Unmute') + ' (M)' : $i18n.t('Mute') + ' (M)'}>
					<button
						class="p-3 rounded-full transition-colors duration-200 {muted
							? 'bg-red-500 text-white'
							: 'bg-gray-50 dark:bg-gray-900'}"
						type="button"
						aria-label={muted ? $i18n.t('Unmute') : $i18n.t('Mute')}
						on:click={toggleMute}
					>
						{#if muted}
							<!-- Mic Off icon -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="size-5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
								/>
								<line
									x1="3"
									y1="3"
									x2="21"
									y2="21"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
								/>
							</svg>
						{:else}
							<!-- Mic On icon -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="size-5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
								/>
							</svg>
						{/if}
					</button>
				</Tooltip>

				<button
					aria-label={$i18n.t('End call')}
					class="p-3 rounded-full bg-gray-50 dark:bg-gray-900"
					on:click={async () => {
						await stopAudioStream();
						await stopVideoStream();

						console.log(audioStream);
						console.log(cameraStream);

						showCallOverlay.set(false);
						dispatch('close');
					}}
					type="button"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						class="size-5"
					>
						<path
							d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}
