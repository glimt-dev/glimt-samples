export type ClassValue = string | number | ClassDictionary | ClassArray | undefined | null | boolean;
export interface ClassDictionary {
	[id: string]: ClassValue;
}
export type ClassArray = Array<ClassValue>;

function toVal(mix: ClassValue): string {
	let k: string;
	let i: number;
	let y: string;
	let str = '';

	if (typeof mix === 'string' || typeof mix === 'number') {
		str += mix;
	} else if (typeof mix === 'object' && mix !== null) {
		if (Array.isArray(mix)) {
			const len = mix.length;
			for (i = 0; i < len; i++) {
				if (mix[i]) {
					y = toVal(mix[i]);
					if (y) {
						if (str) { str += ' '; }
						str += y;
					}
				}
			}
		} else {
			for (k in mix) {
				if (Object.prototype.hasOwnProperty.call(mix, k) && mix[k]) {
					if (str) { str += ' '; }
					str += k;
				}
			}
		}
	}

	return str;
}

export function clsx(...args: ClassValue[]): string {
	let i = 0;
	let tmp: ClassValue;
	let x: string;
	let str = '';
	const len = args.length;

	for (; i < len; i++) {
		tmp = args[i];
		if (tmp) {
			x = toVal(tmp);
			if (x) {
				if (str) { str += ' '; }
				str += x;
			}
		}
	}
	return str;
}

export default clsx;
