<script lang="ts">
	// Pilon family fork: a full-screen "class stream" page that covers the app. Nothing underneath
	// changes; the same switch button in the same spot brings the app back.
	// Edit the constants below to change the class, teacher and posts.
	import { onMount, onDestroy } from 'svelte';
	import { user } from '$lib/stores';

	const CLASS_NAME = 'Classroom';
	// The line under the class name is the logged-in girl's own name.
	$: studentName = ($user?.name ?? '').trim();
	$: studentInitial = studentName ? studentName[0].toUpperCase() : 'S';
	const TEACHER = 'Ms. Reyes';
	const TEACHER_INITIAL = TEACHER.split(' ').pop()?.[0] ?? 'T';

	let prevTitle = '';
	let prevIcon: string | null = null;
	const ICON =
		'data:image/svg+xml,' +
		encodeURIComponent(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1e8e3e"/><rect x="4" y="7" width="24" height="18" rx="2" fill="#0b6b2b"/><rect x="6" y="9" width="20" height="14" rx="1" fill="#e6f4ea"/><circle cx="12" cy="15" r="2.2" fill="#1e8e3e"/><circle cx="20" cy="15" r="2.2" fill="#1e8e3e"/><path d="M8 21c0-2.2 1.8-4 4-4s4 1.8 4 4M16 21c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="#1e8e3e"/></svg>'
		);
	onMount(() => {
		prevTitle = document.title;
		document.title = CLASS_NAME;
		const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
		if (link) {
			prevIcon = link.href;
			link.href = ICON;
		}
	});
	onDestroy(() => {
		document.title = prevTitle;
		const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
		if (link && prevIcon) link.href = prevIcon;
	});

	// Dates are relative to today so the stream always looks current.
	const fmt = (daysAgo: number) => {
		const d = new Date();
		d.setDate(d.getDate() - daysAgo);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	};
	const due = (daysAhead: number) => {
		const d = new Date();
		d.setDate(d.getDate() + daysAhead);
		return d.toLocaleDateString('en-US', { weekday: 'long' });
	};

	type Post = {
		kind: 'assignment' | 'material' | 'announcement';
		title?: string;
		body?: string;
		when: string;
		attachment?: string;
	};
	const posts: Post[] = [
		{
			kind: 'assignment',
			title: 'Short story analysis: paragraph response',
			when: fmt(0)
		},
		{
			kind: 'announcement',
			body: `Reminder: bring your novel to class tomorrow. We'll read chapter 6 together and start the character map, so have your sticky notes ready. If you missed today's lesson, the slides are under Classwork.`,
			when: fmt(1),
			attachment: 'Chapter 6 discussion questions.pdf'
		},
		{
			kind: 'material',
			title: 'Literary devices reference sheet',
			when: fmt(3)
		},
		{
			kind: 'assignment',
			title: 'Vocabulary quiz 3: prefixes and roots',
			when: fmt(5)
		},
		{
			kind: 'announcement',
			body: 'Great work on the presentations this week. Marks and comments will be posted by the weekend. Reading log check is next Monday.',
			when: fmt(7)
		}
	];
	const upcoming = [
		{ due: `Due ${due(1)}`, title: 'Short story analysis: paragraph response' },
		{ due: `Due ${due(4)}`, title: 'Reading log: week 2' }
	];
</script>

<div class="gc fixed inset-0 z-[60] overflow-y-auto bg-white text-[#3c4043]" role="document">
	<!-- top bar -->
	<header class="gc-top">
		<button class="gc-iconbtn" aria-label="Main menu">
			<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#5f6368" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" /></svg>
		</button>
		<div class="gc-brand">
			<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><rect width="32" height="32" rx="6" fill="#1e8e3e"/><rect x="4" y="7" width="24" height="18" rx="2" fill="#0b6b2b"/><rect x="6" y="9" width="20" height="14" rx="1" fill="#e6f4ea"/><circle cx="12" cy="15" r="2.2" fill="#1e8e3e"/><circle cx="20" cy="15" r="2.2" fill="#1e8e3e"/><path d="M8 21c0-2.2 1.8-4 4-4s4 1.8 4 4M16 21c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="#1e8e3e"/></svg>
			<span class="gc-brandtext">Classroom</span>
		</div>
		<nav class="gc-tabs">
			<span class="gc-tab gc-tabsel">Stream</span>
			<span class="gc-tab">Classwork</span>
			<span class="gc-tab">People</span>
		</nav>
		<div class="gc-right">
			<button class="gc-iconbtn" aria-label="Apps">
				<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#5f6368" d="M6 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6-4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-6-4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6 4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
			</button>
			<div class="gc-avatar gc-avatar-me">{studentInitial}</div>
		</div>
	</header>

	<!-- mobile tabs -->
	<nav class="gc-mtabs">
		<span class="gc-tab gc-tabsel">Stream</span>
		<span class="gc-tab">Classwork</span>
		<span class="gc-tab">People</span>
	</nav>

	<div class="gc-page">
		<!-- class banner -->
		<section class="gc-banner">
			<div class="gc-banner-art" aria-hidden="true">
				<span class="gc-shape gc-s1"></span>
				<span class="gc-shape gc-s2"></span>
				<span class="gc-shape gc-s3"></span>
				<span class="gc-book gc-b1"></span>
				<span class="gc-book gc-b2"></span>
				<span class="gc-book gc-b3"></span>
			</div>
			<div class="gc-banner-text">
				<h1>{CLASS_NAME}</h1>
				<div class="gc-section">{studentName}</div>
			</div>
			<button class="gc-banner-info" aria-label="Class information">
				<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#fff" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg>
			</button>
		</section>

		<div class="gc-cols">
			<!-- left: upcoming -->
			<aside class="gc-side">
				<div class="gc-card gc-upcoming">
					<div class="gc-cardtitle">Upcoming</div>
					{#each upcoming as u}
						<div class="gc-up">
							<div class="gc-updue">{u.due}</div>
							<div class="gc-uptitle">{u.title}</div>
						</div>
					{/each}
					<div class="gc-viewall">View all</div>
				</div>
			</aside>

			<!-- main: stream -->
			<main class="gc-stream">
				<div class="gc-card gc-announce">
					<div class="gc-avatar gc-avatar-me">{studentInitial}</div>
					<div class="gc-announce-text">Share something with your class…</div>
				</div>

				{#each posts as p}
					<article class="gc-card gc-post">
						<div class="gc-posthead">
							{#if p.kind === 'announcement'}
								<div class="gc-avatar gc-avatar-t">{TEACHER_INITIAL}</div>
							{:else}
								<div class="gc-postkind">
									{#if p.kind === 'assignment'}
										<svg viewBox="0 0 24 24" width="22" height="22"><path fill="#fff" d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
									{:else}
										<svg viewBox="0 0 24 24" width="22" height="22"><path fill="#fff" d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" /></svg>
									{/if}
								</div>
							{/if}
							<div class="gc-postmeta">
								{#if p.kind === 'announcement'}
									<div class="gc-postname">{TEACHER}</div>
								{:else}
									<div class="gc-postname">{TEACHER} posted a new {p.kind}: {p.title}</div>
								{/if}
								<div class="gc-postdate">{p.when}</div>
							</div>
							<button class="gc-iconbtn gc-more" aria-label="More options">
								<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#5f6368" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
							</button>
						</div>
						{#if p.body}
							<div class="gc-postbody">{p.body}</div>
						{/if}
						{#if p.attachment}
							<div class="gc-attach">
								<div class="gc-attach-thumb"></div>
								<div class="gc-attach-meta">
									<div class="gc-attach-name">{p.attachment}</div>
									<div class="gc-attach-type">PDF</div>
								</div>
							</div>
						{/if}
						{#if p.kind === 'announcement'}
							<div class="gc-comment">
								<div class="gc-avatar gc-avatar-me gc-avatar-sm">{studentInitial}</div>
								<div class="gc-comment-box">Add class comment…</div>
							</div>
						{/if}
					</article>
				{/each}
			</main>
		</div>
	</div>
</div>

<style>
	.gc { font-family: 'Google Sans', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; }
	.gc-top { position: sticky; top: 0; z-index: 2; height: 64px; display: flex; align-items: center; gap: 4px; padding: 0 8px; background: #fff; border-bottom: 1px solid #dadce0; box-sizing: border-box; }
	.gc-iconbtn { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: none; border: 0; flex: none; }
	.gc-brand { display: flex; align-items: center; gap: 8px; min-width: 0; padding-left: 4px; }
	.gc-brandtext { font-size: 22px; color: #5f6368; }
	.gc-tabs { position: absolute; left: 50%; transform: translateX(-50%); top: 0; height: 64px; display: flex; }
	.gc-tab { display: flex; align-items: center; height: 100%; padding: 0 24px; color: #5f6368; font-weight: 500; font-size: 14px; letter-spacing: .25px; border-bottom: 3px solid transparent; box-sizing: border-box; }
	.gc-tab.gc-tabsel { color: #1e8e3e; border-bottom-color: #1e8e3e; }
	.gc-right { margin-left: auto; display: flex; align-items: center; gap: 4px; padding-right: 36px; }
	.gc-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 500; font-size: 15px; flex: none; }
	.gc-avatar-me { background: #7b1fa2; }
	.gc-avatar-t { background: #00796b; }
	.gc-avatar-sm { width: 28px; height: 28px; font-size: 13px; }
	.gc-mtabs { display: none; }

	.gc-page { max-width: 1000px; margin: 0 auto; padding: 24px 24px 48px; }
	.gc-banner { position: relative; height: 240px; border-radius: 8px; overflow: hidden; background: linear-gradient(135deg, #1e8e3e 0%, #0d652d 100%); color: #fff; }
	.gc-banner-art { position: absolute; inset: 0; }
	.gc-shape { position: absolute; border-radius: 50%; background: rgba(255,255,255,.08); }
	.gc-s1 { width: 320px; height: 320px; right: -80px; top: -140px; }
	.gc-s2 { width: 180px; height: 180px; right: 220px; top: -60px; background: rgba(255,255,255,.05); }
	.gc-s3 { width: 120px; height: 120px; right: 60px; bottom: -50px; background: rgba(255,255,255,.06); }
	.gc-book { position: absolute; bottom: 28px; width: 34px; border-radius: 3px 3px 2px 2px; background: #e6f4ea; box-shadow: inset 0 0 0 3px #b7dfc0; }
	.gc-b1 { right: 150px; height: 110px; background: #fbbc04; box-shadow: inset 0 0 0 3px #e0a800; }
	.gc-b2 { right: 112px; height: 90px; background: #e8f0fe; box-shadow: inset 0 0 0 3px #aecbfa; }
	.gc-b3 { right: 74px; height: 124px; background: #fce8e6; box-shadow: inset 0 0 0 3px #f5b5ae; }
	.gc-banner-text { position: absolute; left: 24px; bottom: 20px; right: 80px; }
	.gc-banner h1 { margin: 0; font-size: 36px; font-weight: 400; line-height: 1.2; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
	.gc-section { font-size: 20px; margin-top: 4px; opacity: .95; }
	.gc-banner-info { position: absolute; right: 16px; bottom: 16px; width: 40px; height: 40px; border-radius: 50%; border: 0; background: none; display: flex; align-items: center; justify-content: center; }

	.gc-cols { display: flex; gap: 24px; margin-top: 24px; align-items: flex-start; }
	.gc-side { width: 200px; flex: none; }
	.gc-stream { flex: 1; min-width: 0; }
	.gc-card { background: #fff; border: 1px solid #dadce0; border-radius: 8px; padding: 16px; box-sizing: border-box; }
	.gc-cardtitle { font-size: 14px; font-weight: 500; color: #3c4043; margin-bottom: 8px; }
	.gc-up { margin: 10px 0; }
	.gc-updue { font-size: 12px; color: #5f6368; }
	.gc-uptitle { font-size: 13px; color: #3c4043; }
	.gc-viewall { text-align: right; color: #1e8e3e; font-weight: 500; font-size: 14px; margin-top: 8px; }

	.gc-announce { display: flex; align-items: center; gap: 16px; padding: 16px 24px; margin-bottom: 24px; box-shadow: 0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15); border: 0; }
	.gc-announce-text { color: #5f6368; font-size: 14px; }
	.gc-post { margin-bottom: 16px; padding: 16px 24px; }
	.gc-posthead { display: flex; align-items: center; gap: 16px; }
	.gc-postkind { width: 40px; height: 40px; border-radius: 50%; background: #1e8e3e; display: flex; align-items: center; justify-content: center; flex: none; }
	.gc-postmeta { flex: 1; min-width: 0; }
	.gc-postname { font-size: 14px; font-weight: 500; color: #3c4043; }
	.gc-postdate { font-size: 12px; color: #5f6368; }
	.gc-more { width: 40px; height: 40px; margin-right: -8px; }
	.gc-postbody { margin: 12px 0 0 56px; font-size: 14px; color: #3c4043; white-space: pre-line; }
	.gc-attach { margin: 16px 0 0 56px; display: flex; align-items: stretch; border: 1px solid #dadce0; border-radius: 8px; overflow: hidden; max-width: 420px; }
	.gc-attach-thumb { width: 96px; flex: none; background: linear-gradient(#f1f3f4, #e8eaed); border-right: 1px solid #dadce0; }
	.gc-attach-meta { padding: 12px 16px; min-width: 0; }
	.gc-attach-name { font-size: 14px; color: #3c4043; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.gc-attach-type { font-size: 12px; color: #5f6368; margin-top: 2px; }
	.gc-comment { display: flex; align-items: center; gap: 12px; margin: 16px -24px -16px; padding: 12px 24px; border-top: 1px solid #dadce0; }
	.gc-comment-box { flex: 1; border: 1px solid #dadce0; border-radius: 20px; padding: 8px 16px; color: #5f6368; font-size: 14px; }

	@media (max-width: 720px) {
		.gc-top { height: 56px; }
		.gc-tabs { display: none; }
		.gc-brandtext { font-size: 18px; color: #3c4043; }
		.gc-right { padding-right: 32px; }
		.gc-mtabs { display: flex; height: 48px; border-bottom: 1px solid #dadce0; background: #fff; position: sticky; top: 56px; z-index: 2; }
		.gc-mtabs .gc-tab { flex: 1; justify-content: center; padding: 0; }
		.gc-page { padding: 0 0 40px; }
		.gc-banner { height: 150px; border-radius: 0; }
		.gc-banner h1 { font-size: 24px; }
		.gc-section { font-size: 14px; }
		.gc-b1, .gc-b2, .gc-b3 { transform: scale(.7); bottom: 10px; }
		.gc-cols { display: block; margin-top: 0; padding: 0 12px; }
		.gc-side { width: auto; margin: 12px 0; }
		.gc-announce { margin: 12px 0; }
		.gc-post { padding: 16px; }
		.gc-postbody, .gc-attach { margin-left: 0; }
		.gc-comment { margin: 16px -16px -16px; padding: 12px 16px; }
	}
</style>
