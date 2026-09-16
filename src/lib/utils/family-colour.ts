// Pilon family fork: each account can pick its own colour (a two-stop gradient).
// The choice lives in the user's UI settings as `familyColour: { from, to }` and is
// applied as CSS variables on <html>, so the user's own chat bubbles, the mic, the
// voice-mode button and the send button take that colour. Assistant replies keep the
// stock look, so a question and an answer never look alike.

export type FamilyColour = { from: string; to: string };

export const FAMILY_COLOUR_PRESETS: { name: string; from: string; to: string }[] = [
	{ name: 'Pink', from: '#ff5fa2', to: '#ffa3d7' },
	{ name: 'Purple', from: '#8b5cf6', to: '#e879f9' },
	{ name: 'Blue', from: '#3b82f6', to: '#22d3ee' },
	{ name: 'Teal', from: '#14b8a6', to: '#a3e635' },
	{ name: 'Sunset', from: '#f97316', to: '#facc15' },
	{ name: 'Red', from: '#ef4444', to: '#fb7185' }
];

const HEX = /^#([0-9a-f]{6})$/i;

const luminance = (hex: string) => {
	const m = HEX.exec(hex);
	if (!m) return 0;
	const n = parseInt(m[1], 16);
	const ch = (v: number) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * ch(n >> 16) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
};

export const isFamilyColour = (c: unknown): c is FamilyColour =>
	!!c &&
	typeof c === 'object' &&
	HEX.test((c as FamilyColour).from ?? '') &&
	HEX.test((c as FamilyColour).to ?? '');

export const applyFamilyColour = (c: unknown) => {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	if (!isFamilyColour(c)) {
		root.classList.remove('family-colour');
		root.style.removeProperty('--family-from');
		root.style.removeProperty('--family-to');
		root.style.removeProperty('--family-text');
		return;
	}
	root.style.setProperty('--family-from', c.from);
	root.style.setProperty('--family-to', c.to);
	// Text on the gradient: dark on light pastels, white on deep colours.
	const light = (luminance(c.from) + luminance(c.to)) / 2 > 0.45;
	root.style.setProperty('--family-text', light ? '#111827' : '#ffffff');
	root.classList.add('family-colour');
};
