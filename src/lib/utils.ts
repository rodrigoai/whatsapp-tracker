export function formatWhatsAppNumber(phone: string): string {
  const finalPhone = phone.replace(/\D/g, "");
  if (!finalPhone.startsWith("55") && finalPhone.length <= 11) {
    return `55${finalPhone}`;
  }
  return finalPhone;
}

export function getNextAttendant<T>(attendants: T[], customerCount: number) {
  if (attendants.length === 0) return null;
  return attendants[customerCount % attendants.length];
}
