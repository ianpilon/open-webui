<script lang="ts">
	// Pilon family fork: a full-screen reading page that covers the app. Nothing underneath
	// changes; the same switch button in the same spot brings the app back.
	import { onMount, onDestroy } from 'svelte';
	import { showCover } from '$lib/stores';

	let prevTitle = '';
	let prevIcon: string | null = null;
	const W_ICON =
		'data:image/svg+xml,' +
		encodeURIComponent(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#fff"/><text x="16" y="24" font-family="Georgia,serif" font-size="24" text-anchor="middle" fill="#000">W</text></svg>'
		);
	onMount(() => {
		prevTitle = document.title;
		document.title = 'Socrates - Wikipedia';
		const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
		if (link) {
			prevIcon = link.href;
			link.href = W_ICON;
		}
	});
	onDestroy(() => {
		document.title = prevTitle;
		const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
		if (link && prevIcon) link.href = prevIcon;
	});
	const sections = [
		['Life', 'Socrates was born in Athens around 470 BC, the son of Sophroniscus, a stoneworker, and Phaenarete, a midwife. Little is known of his early years. He served as a hoplite in the Athenian army and was noted by contemporaries for his physical endurance and composure in retreat. He married Xanthippe and had three sons. Unlike the professional teachers of his day, he took no fees and owned little, spending his time in the agora and the gymnasia in conversation with anyone willing to talk.'],
		['Trial and death', 'In 399 BC Socrates was brought to trial on charges of impiety and of corrupting the young. The accusation followed years of political upheaval in Athens, including the rule of the Thirty Tyrants, some of whom had been associated with him. A jury of several hundred citizens found him guilty by a narrow margin. Offered the chance to propose a penalty, he suggested he be rewarded for his service to the city, which offended the jury; the sentence was death. He declined an opportunity to escape, arguing that a citizen who had accepted the laws of the city all his life should not flee them now, and died by drinking hemlock among his friends.'],
		['Philosophy', 'Socrates wrote nothing. What is known of his thought comes through his students, above all Plato, whose early dialogues are generally taken to reflect the historical Socrates most closely, and Xenophon. His method was conversational: he questioned people who claimed to know what courage, justice or piety was, and through further questions led them to see that their definitions did not hold. The aim was not to embarrass but to clear away false confidence so that real inquiry could begin. This procedure, later called the Socratic method or elenchus, remains a foundation of philosophical and legal teaching.'],
		['Ethics', 'Socrates held that virtue is a kind of knowledge and that no one does wrong willingly: a person who truly understood what was good would act on it. He argued that it is better to suffer injustice than to commit it, and that the care of the soul matters more than wealth, reputation or the body. The statement associated with him that "the unexamined life is not worth living" summarises this outlook.'],
		['Legacy', 'Through Plato, Aristotle and the Hellenistic schools that claimed his example, Socrates shaped the whole subsequent course of Western philosophy. The Cynics, the Stoics and the Skeptics each traced part of their teaching to him. His trial has been read for more than two millennia as a case study in the relationship between the individual conscience and the state, and his figure appears throughout art, drama and literature from antiquity to the present.']
	];
	const refs = [
		'Plato. Apology, Crito, Euthyphro. Various translations.',
		'Xenophon. Memorabilia. Various translations.',
		'Vlastos, Gregory (1991). Socrates, Ironist and Moral Philosopher. Cambridge University Press.',
		'Kahn, Charles H. (1996). Plato and the Socratic Dialogue. Cambridge University Press.',
		'Nails, Debra (2002). The People of Plato. Hackett Publishing.'
	];
</script>

<div class="wk fixed inset-0 z-[60] overflow-y-auto bg-white text-[#202122]" role="document">
	<!-- header -->
	<div class="wk-head">
		<div class="wk-headin">
			<button class="wk-burger" aria-label="Main menu"><span></span><span></span><span></span></button>
			<div class="wk-logo">
				<div class="wk-globe">W</div>
				<div class="wk-wordmark">
					<div class="wk-wm1">WIKIPEDIA</div>
					<div class="wk-wm2">The Free Encyclopedia</div>
				</div>
			</div>
			<div class="wk-search">
				<span class="wk-searchicon"></span>
				<input type="text" placeholder="Search Wikipedia" readonly />
				<span class="wk-searchbtn">Search</span>
			</div>
			<div class="wk-user">Log in</div>
		</div>
	</div>

	<div class="wk-body">
		<!-- left TOC (desktop) -->
		<nav class="wk-toc">
			<div class="wk-tochead">Contents</div>
			<ul>
				<li class="wk-tocsel">(Top)</li>
				{#each sections as [t]}<li>{t}</li>{/each}
				<li>References</li>
			</ul>
		</nav>

		<article class="wk-article">
			<div class="wk-tabs">
				<span class="wk-tabsel">Article</span><span>Talk</span>
				<span class="wk-tabright"><span class="wk-tabsel">Read</span><span>View source</span><span>View history</span></span>
			</div>
			<h1>Socrates</h1>
			<div class="wk-from">From Wikipedia, the free encyclopedia</div>

			<table class="wk-infobox">
				<tbody>
					<tr><th colspan="2" class="wk-ibtitle">Socrates</th></tr>
					<tr><td colspan="2" class="wk-ibimg"><img class="wk-img" src="/family/socrates.webp" alt="Marble bust of Socrates" width="220" /><div class="wk-cap">Marble bust of Socrates, Roman copy of a Greek original, Louvre</div></td></tr>
					<tr><th>Born</th><td>c. 470 BC<br />Deme Alopece, Athens</td></tr>
					<tr><th>Died</th><td>399 BC (aged approximately 71)<br />Athens</td></tr>
					<tr><th>Cause of death</th><td>Execution by forced suicide (poisoning)</td></tr>
					<tr><th>Spouse</th><td>Xanthippe</td></tr>
					<tr><th>Era</th><td>Ancient Greek philosophy</td></tr>
					<tr><th>Region</th><td>Western philosophy</td></tr>
					<tr><th>School</th><td>Classical Greek philosophy</td></tr>
					<tr><th>Notable students</th><td>Plato, Xenophon, Antisthenes, Aristippus, Alcibiades</td></tr>
					<tr><th>Main interests</th><td>Ethics, epistemology</td></tr>
					<tr><th>Notable ideas</th><td>Socratic method, Socratic irony, Socratic intellectualism</td></tr>
				</tbody>
			</table>

			<p><b>Socrates</b> (<i>c.</i> 470 – 399 BC) was a Greek philosopher from Athens who is credited as a founder of Western philosophy and among the first moral philosophers of the ethical tradition of thought. An enigmatic figure, Socrates authored no texts and is known mainly through the posthumous accounts of classical writers, particularly his students Plato and Xenophon.</p>
			<p>These accounts are written as dialogues, in which Socrates and his interlocutors examine a subject in the style of question and answer; they gave rise to the Socratic dialogue literary genre. Contradictory accounts of Socrates make a reconstruction of his philosophy nearly impossible, a situation known as the Socratic problem. Socrates was a polarizing figure in Athenian society. In 399 BC he was accused of impiety and corrupting the youth. After a trial that lasted a day, he was sentenced to death.</p>
			<p>Plato's dialogues are among the most comprehensive accounts of Socrates to survive from antiquity. They demonstrate the Socratic approach to areas of philosophy including epistemology and ethics. The Platonic Socrates lends his name to the concept of the Socratic method, and also to Socratic irony. The Socratic method of questioning, or elenchus, takes shape in dialogue using short questions and answers, epitomized by those Platonic texts in which Socrates and his interlocutors examine various aspects of an issue or an abstract meaning, usually relating to one of the virtues, and find themselves at an impasse, completely unable to define what they thought they understood.</p>

			{#each sections as [t, body]}
				<h2>{t}</h2>
				<p>{body}</p>
			{/each}

			<h2>References</h2>
			<ol class="wk-refs">
				{#each refs as r}<li>{r}</li>{/each}
			</ol>
			<div class="wk-foot">This page was last edited on 3 September 2026, at 14:12 (UTC). Text is available under the Creative Commons Attribution-ShareAlike 4.0 License; additional terms may apply.</div>
		</article>
	</div>
</div>

<style>
	.wk { font-family: sans-serif; font-size: 14px; line-height: 1.6; }
	.wk-head { border-bottom: 1px solid #a2a9b1; background: #fff; }
	.wk-headin { max-width: 1596px; margin: 0 auto; display: flex; align-items: center; gap: 12px; padding: 6px 16px 6px 12px; height: 54px; box-sizing: border-box; }
	.wk-burger { width: 34px; height: 34px; display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 0 9px; background: none; border: 0; }
	.wk-burger span { display: block; height: 2px; background: #202122; }
	.wk-logo { display: flex; align-items: center; gap: 8px; min-width: 0; }
	.wk-globe { width: 40px; height: 40px; border-radius: 50%; border: 2px solid #202122; display: flex; align-items: center; justify-content: center; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; flex: none; }
	.wk-wm1 { font-family: Georgia, 'Times New Roman', serif; font-size: 16px; letter-spacing: 1px; line-height: 1.1; }
	.wk-wm2 { font-family: Georgia, 'Times New Roman', serif; font-size: 10px; color: #202122; }
	.wk-search { flex: 1; max-width: 500px; margin-left: 16px; display: flex; align-items: center; border: 1px solid #a2a9b1; border-radius: 2px; height: 32px; overflow: hidden; }
	.wk-searchicon { width: 30px; height: 100%; background: radial-gradient(circle at 12px 12px, transparent 5px, #72777d 5px, #72777d 6.5px, transparent 6.5px); position: relative; }
	.wk-search input { flex: 1; border: 0; outline: 0; font-size: 14px; padding: 0 6px; min-width: 0; }
	.wk-searchbtn { padding: 0 12px; border-left: 1px solid #a2a9b1; height: 100%; display: flex; align-items: center; background: #f8f9fa; color: #202122; }
	.wk-user { margin-left: auto; color: #36c; padding-right: 44px; white-space: nowrap; }
	.wk-body { max-width: 1596px; margin: 0 auto; display: flex; gap: 24px; padding: 8px 16px 40px; }
	.wk-toc { width: 180px; flex: none; position: sticky; top: 8px; align-self: flex-start; font-size: 13px; }
	.wk-tochead { font-weight: bold; padding: 6px 0; border-bottom: 1px solid #a2a9b1; margin-bottom: 4px; }
	.wk-toc ul { list-style: none; margin: 0; padding: 0; }
	.wk-toc li { padding: 4px 8px; color: #36c; }
	.wk-toc li.wk-tocsel { color: #202122; border-left: 3px solid #36c; background: #eaf3ff; }
	.wk-article { flex: 1; min-width: 0; max-width: 960px; }
	.wk-tabs { display: flex; gap: 14px; font-size: 13px; color: #36c; border-bottom: 1px solid #a2a9b1; padding-bottom: 4px; margin-bottom: 4px; }
	.wk-tabs .wk-tabsel { color: #202122; font-weight: normal; border-bottom: 2px solid #36c; padding-bottom: 4px; }
	.wk-tabright { margin-left: auto; display: flex; gap: 14px; }
	.wk h1 { font-family: 'Linux Libertine', Georgia, 'Times New Roman', serif; font-weight: normal; font-size: 28.8px; margin: 6px 0 2px; line-height: 1.3; }
	.wk-from { font-size: 12.5px; color: #54595d; margin-bottom: 10px; }
	.wk h2 { font-family: 'Linux Libertine', Georgia, 'Times New Roman', serif; font-weight: normal; font-size: 22.4px; border-bottom: 1px solid #a2a9b1; margin: 22px 0 6px; padding-bottom: 2px; }
	.wk p { margin: 8px 0 12px; }
	.wk-infobox { float: right; clear: right; width: 272px; margin: 6px 0 12px 20px; border: 1px solid #a2a9b1; background: #f8f9fa; font-size: 12.5px; border-collapse: collapse; line-height: 1.4; }
	.wk-infobox th, .wk-infobox td { padding: 4px 8px; vertical-align: top; text-align: left; }
	.wk-infobox th { width: 38%; font-weight: bold; }
	.wk-infobox .wk-ibtitle { text-align: center; font-size: 16px; padding: 8px; background: #cedff2; }
	.wk-ibimg { text-align: center; }
	.wk-img { display: block; width: 220px; max-width: 100%; height: auto; margin: 4px auto; }
	.wk-cap { font-size: 11.5px; color: #54595d; padding: 2px 4px 4px; }
	.wk-refs { font-size: 12.5px; padding-left: 22px; }
	.wk-refs li { margin: 4px 0; }
	.wk-foot { font-size: 11.5px; color: #54595d; margin-top: 30px; border-top: 1px solid #eaecf0; padding-top: 10px; }
	@media (max-width: 720px) {
		.wk { font-size: 16px; }
		.wk-headin { height: 52px; gap: 8px; }
		.wk-search, .wk-user, .wk-wm2 { display: none; }
		.wk-globe { display: none; }
		.wk-wm1 { font-size: 20px; letter-spacing: 0; }
		.wk-body { display: block; padding: 4px 16px 40px; }
		.wk-toc, .wk-tabs { display: none; }
		.wk h1 { font-size: 26px; }
		.wk-infobox { float: none; width: 100%; margin: 8px 0 14px; }
		.wk-user { display: none; }
	}
</style>
