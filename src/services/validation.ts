/**
 * CPF and CNPJ Mask formatting and mathematical validation
 */

/**
 * Formats a raw digits string as CPF or CNPJ in real-time as the user types
 */
export function formatCPFOrCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  
  if (digits.length <= 11) {
    // Format CPF: 000.000.000-00
    let formatted = digits;
    if (digits.length > 9) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    } else if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    return formatted;
  } else {
    // Format CNPJ: 00.000.000/0000-00
    let formatted = digits;
    if (digits.length > 12) {
      formatted = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    } else if (digits.length > 8) {
      formatted = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    } else if (digits.length > 5) {
      formatted = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    }
    return formatted;
  }
}

/**
 * Mathematically validates a CPF string
 */
export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false; // same digits
  
  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i]) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean[9])) return false;
  
  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i]) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean[10])) return false;
  
  return true;
}

/**
 * Mathematically validates a CNPJ string
 */
export function validateCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false; // same digits

  // Validate digit 1
  let length = 12;
  let numbers = clean.substring(0, length);
  const digits = clean.substring(length);
  let sum = 0;
  let pos = 5;
  for (let i = 0; i < length; i++) {
    sum += parseInt(numbers.charAt(i)) * pos;
    pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  // Validate digit 2
  length = 13;
  numbers = clean.substring(0, length);
  sum = 0;
  pos = 6;
  for (let i = 0; i < length; i++) {
    sum += parseInt(numbers.charAt(i)) * pos;
    pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Validates either CPF or CNPJ format and check digits
 */
export function validateCPFOrCNPJ(value: string): boolean {
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) {
    return validateCPF(clean);
  } else if (clean.length === 14) {
    return validateCNPJ(clean);
  }
  return false;
}
