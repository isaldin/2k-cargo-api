export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new Error('Phone number must contain between 10 and 15 digits');
  }
  return digits;
}
