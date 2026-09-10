<script lang="ts">
	// Pilon family fork: one button, one fixed spot (top right), in both the app and the cover.
	export let onClick: () => void = () => {};
	export let subtle = false; // on the cover page it should read as a plain grey glyph
</script>

<button
	type="button"
	aria-label="Switch"
	title="Switch"
	on:click={onClick}
	class="fixed top-2.5 right-3 z-[70] flex size-8 items-center justify-center rounded-md transition {subtle
		? 'text-[#54595d] hover:bg-[#eaecf0]'
		: 'text-gray-500 hover:bg-gray-50/40 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/40 dark:hover:text-gray-200'}"
>
	<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
		<path d="M3 10.5a5.5 5.5 0 0 1 5.5-5.5H12V2.6c0-.5.6-.8 1-.5l5.2 4.2c.3.3.3.8 0 1L13 11.6c-.4.3-1 0-1-.5V8.7H8.5A2.7 2.7 0 0 0 5.8 11.4v.6H3v-1.5Z" />
		<path d="M21 13.5a5.5 5.5 0 0 1-5.5 5.5H12v2.4c0 .5-.6.8-1 .5l-5.2-4.2a.7.7 0 0 1 0-1L11 12.4c.4-.3 1 0 1 .5v2.4h3.5a2.7 2.7 0 0 0 2.7-2.7v-.6H21v1.5Z" />
	</svg>
</button>
