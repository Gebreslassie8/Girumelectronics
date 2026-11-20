// lib/validators.js
export const PHONE_REGEX = /^(\+251|0)9\d{8}$/;
export const PHONE_MSG = 'ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ምሳሌ: 0912345678)';

export function validateRegister({ fullName, phone, email, password }) {
  const errors = {};

  if (!fullName || fullName.trim().length < 2) {
    errors.fullName = 'ሙሉ ስም ቢያንስ 2 ፊደል መሆን አለበት';
  }
  if (!phone || !PHONE_REGEX.test(phone)) {
    errors.phone = PHONE_MSG;
  }
  if (!password || password.length < 6) {
    errors.password = 'ፓስወርድ ቢያንስ 6 ፊደል መሆን አለበት';
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'ትክክለኛ ኢሜይል ያስገቡ';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}