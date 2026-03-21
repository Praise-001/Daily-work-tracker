import type { CurrencyInfo } from "./types";

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$",   label: "US Dollar" },
  { code: "NGN", symbol: "₦",   label: "Nigerian Naira" },
  { code: "GBP", symbol: "£",   label: "British Pound" },
  { code: "EUR", symbol: "€",   label: "Euro" },
  { code: "GHS", symbol: "₵",   label: "Ghanaian Cedi" },
  { code: "KES", symbol: "KSh", label: "Kenyan Shilling" },
  { code: "ZAR", symbol: "R",   label: "South African Rand" },
  { code: "CAD", symbol: "C$",  label: "Canadian Dollar" },
  { code: "AUD", symbol: "A$",  label: "Australian Dollar" },
  { code: "JPY", symbol: "¥",   label: "Japanese Yen" },
  { code: "INR", symbol: "₹",   label: "Indian Rupee" },
  { code: "BRL", symbol: "R$",  label: "Brazilian Real" },
  { code: "MXN", symbol: "MX$", label: "Mexican Peso" },
  { code: "CHF", symbol: "Fr",  label: "Swiss Franc" },
  { code: "CNY", symbol: "¥",   label: "Chinese Yuan" },
  { code: "EGP", symbol: "E£",  label: "Egyptian Pound" },
  { code: "ZMW", symbol: "ZK",  label: "Zambian Kwacha" },
  { code: "TZS", symbol: "TSh", label: "Tanzanian Shilling" },
  { code: "UGX", symbol: "USh", label: "Ugandan Shilling" },
  { code: "RWF", symbol: "RF",  label: "Rwandan Franc" },
  { code: "MAD", symbol: "MAD", label: "Moroccan Dirham" },
  { code: "AED", symbol: "AED", label: "UAE Dirham" },
  { code: "SGD", symbol: "S$",  label: "Singapore Dollar" },
  { code: "NZD", symbol: "NZ$", label: "New Zealand Dollar" },
];

export function getCurrencyByCode(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}
