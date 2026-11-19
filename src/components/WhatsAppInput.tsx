import type { KeyboardEvent } from 'react';
import { sanitizeWhatsAppTyping } from '../utils/whatsapp';

interface WhatsAppInputProps {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const ALLOWED_CONTROL_KEYS = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Escape',
  'Enter',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

export function WhatsAppInput({
  id,
  value,
  onChange,
  placeholder = '081234567890',
  required = false,
  className = '',
}: WhatsAppInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey || ALLOWED_CONTROL_KEYS.has(e.key)) {
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <input
      id={id}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="tel-national"
      required={required}
      value={value}
      onKeyDown={handleKeyDown}
      onChange={(e) => onChange(sanitizeWhatsAppTyping(e.target.value))}
      placeholder={placeholder}
      className={
        className ||
        'w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 font-mono text-sm text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0B2229] dark:text-[#E6F4F7] dark:placeholder:text-[#6D8B94] dark:focus:border-[#3EC1D3]'
      }
    />
  );
}
