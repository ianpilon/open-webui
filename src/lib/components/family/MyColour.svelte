<script lang="ts">
	// Pilon family fork: "My colour" picker in Settings > Interface. Six preset gradients
	// plus two free colour wells; "Off" returns to the stock grey. Saved per account.
	import { getContext } from 'svelte';
	import { settings } from '$lib/stores';
	import {
		FAMILY_COLOUR_PRESETS,
		applyFamilyColour,
		isFamilyColour,
		type FamilyColour
	} from '$lib/utils/family-colour';

	const i18n: any = getContext('i18n');

	export let saveSettings: Function;

	let from = '#ff5fa2';
	let to = '#ffa3d7';
	let enabled = false;

	$: {
		const c = $settings?.familyColour;
		if (isFamilyColour(c)) {
			from = c.from;
			to = c.to;
			enabled = true;
		} else {
			enabled = false;
		}
	}

	const set = (c: FamilyColour | null) => {
		applyFamilyColour(c);
		saveSettings({ familyColour: c });
	};

	// Reactive, so the swatch rings update when the choice changes (a plain function
	// called from the template would not re-run when `enabled`/`from`/`to` change).
	$: selected = enabled ? `${from}|${to}`.toLowerCase() : '';
</script>

<div>
	<div class="flex items-center justify-between gap-2.5">
		<div class="min-w-0 text-xs text-gray-600 dark:text-gray-400">{$i18n.t('My colour')}</div>
		<div class="flex shrink-0 items-center justify-end gap-1.5">
			<button
				type="button"
				class="px-2.5 py-0.5 text-xs rounded-full border transition {enabled
					? 'border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white'
					: 'border-gray-900 dark:border-white text-gray-900 dark:text-white'}"
				on:click={() => set(null)}
			>
				{$i18n.t('Off')}
			</button>
		</div>
	</div>

	<div class="mt-2 flex flex-wrap items-center gap-2">
		{#each FAMILY_COLOUR_PRESETS as p}
			<button
				type="button"
				aria-label={p.name}
				title={p.name}
				class="size-7 rounded-full transition ring-offset-2 ring-offset-white dark:ring-offset-gray-900 {selected === `${p.from}|${p.to}`.toLowerCase()
					? 'ring-2 ring-gray-900 dark:ring-white'
					: 'hover:scale-110'}"
				style="background: linear-gradient(135deg, {p.from}, {p.to});"
				on:click={() => set({ from: p.from, to: p.to })}
			></button>
		{/each}

		<span class="mx-1 text-[0.6875rem] text-gray-400 dark:text-gray-600">{$i18n.t('or pick your own')}</span>

		<label class="relative size-7 rounded-full overflow-hidden cursor-pointer" title={$i18n.t('Start colour')}>
			<input
				type="color"
				class="absolute inset-0 size-full cursor-pointer"
				bind:value={from}
				on:change={() => set({ from, to })}
			/>
		</label>
		<span class="text-gray-400 dark:text-gray-600 text-xs">→</span>
		<label class="relative size-7 rounded-full overflow-hidden cursor-pointer" title={$i18n.t('End colour')}>
			<input
				type="color"
				class="absolute inset-0 size-full cursor-pointer"
				bind:value={to}
				on:change={() => set({ from, to })}
			/>
		</label>

		<div
			class="ml-auto px-3 py-1 rounded-2xl text-xs family-bubble-preview"
			style={enabled
				? `background: linear-gradient(135deg, ${from}, ${to}); color: var(--family-text, #fff);`
				: ''}
		>
			{$i18n.t('Your messages look like this')}
		</div>
	</div>

	<p class="mt-1.5 text-[0.6875rem] text-gray-400 dark:text-gray-600">
		{$i18n.t('Colours your own messages, the mic and the send button, so your questions stand apart from the answers.')}
	</p>
</div>
