export function formatWhatsAppNumber(phone: string): string {
  let finalPhone = phone.replace(/\D/g, "");
  if (!finalPhone.startsWith("55") && finalPhone.length <= 11) {
    return `55${finalPhone}`;
  }
  return finalPhone;
}

export function getNextAttendant(attendants: any[], customerCount: number) {
  if (attendants.length === 0) return null;
  return attendants[customerCount % attendants.length];
}
