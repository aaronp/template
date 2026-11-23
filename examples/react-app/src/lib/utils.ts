import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names, letting later Tailwind classes override earlier ones (shadcn's `cn`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The app's greeting.
 * @param name who to greet
 * @example greet('world') // 'Hello, world!'
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
