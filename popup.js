// ============================================
// KeyForge — Password Generator Logic
// ============================================

(function () {
  'use strict';

  // --- Character Sets ---
  const CHAR_SETS = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
  };

  const AMBIGUOUS_CHARS = 'lI1O0oS5Z2B8';

  // --- DOM Elements ---
  const elements = {
    passwordText: document.getElementById('password-text'),
    copyBtn: document.getElementById('copy-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    generateBtn: document.getElementById('generate-btn'),
    lengthSlider: document.getElementById('length-slider'),
    lengthInput: document.getElementById('length-input'),
    strengthBar: document.getElementById('strength-bar'),
    strengthText: document.getElementById('strength-text'),
    customExclude: document.getElementById('custom-exclude'),
    toast: document.getElementById('toast'),
    // Checkboxes
    optUppercase: document.getElementById('opt-uppercase'),
    optLowercase: document.getElementById('opt-lowercase'),
    optNumbers: document.getElementById('opt-numbers'),
    optSymbols: document.getElementById('opt-symbols'),
    optNoRepeat: document.getElementById('opt-no-repeat'),
    optNoAmbiguous: document.getElementById('opt-no-ambiguous'),
    optNoSequential: document.getElementById('opt-no-sequential'),
    optBeginLetter: document.getElementById('opt-begin-letter')
  };

  let currentPassword = '';
  let toastTimeout = null;

  // --- Crypto-safe random ---
  function secureRandom(max) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }

  // --- Shuffle array (Fisher-Yates with crypto) ---
  function secureShuffle(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = secureRandom(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // --- Check if chars are sequential ---
  function isSequential(charA, charB) {
    const codeA = charA.charCodeAt(0);
    const codeB = charB.charCodeAt(0);
    return Math.abs(codeA - codeB) === 1;
  }

  // --- Build character pool ---
  function buildCharPool() {
    let pool = '';

    if (elements.optUppercase.checked) pool += CHAR_SETS.uppercase;
    if (elements.optLowercase.checked) pool += CHAR_SETS.lowercase;
    if (elements.optNumbers.checked) pool += CHAR_SETS.numbers;
    if (elements.optSymbols.checked) pool += CHAR_SETS.symbols;

    // Remove ambiguous characters
    if (elements.optNoAmbiguous.checked) {
      pool = pool.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
    }

    // Remove custom excluded characters
    const customExclude = elements.customExclude.value;
    if (customExclude.length > 0) {
      pool = pool.split('').filter(c => !customExclude.includes(c)).join('');
    }

    return pool;
  }

  // --- Get letter pool (for begin-with-letter option) ---
  function getLetterPool() {
    let letters = '';
    if (elements.optUppercase.checked) letters += CHAR_SETS.uppercase;
    if (elements.optLowercase.checked) letters += CHAR_SETS.lowercase;

    if (elements.optNoAmbiguous.checked) {
      letters = letters.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
    }

    const customExclude = elements.customExclude.value;
    if (customExclude.length > 0) {
      letters = letters.split('').filter(c => !customExclude.includes(c)).join('');
    }

    return letters;
  }

  // --- Generate Password ---
  function generatePassword() {
    const length = parseInt(elements.lengthInput.value, 10);
    const pool = buildCharPool();
    const noRepeat = elements.optNoRepeat.checked;
    const noSequential = elements.optNoSequential.checked;
    const beginLetter = elements.optBeginLetter.checked;

    // Validation
    if (pool.length === 0) {
      showError('Select at least one character type');
      return null;
    }

    if (noRepeat && length > pool.length) {
      showError(`No-repeat needs at most ${pool.length} chars`);
      return null;
    }

    let password = [];
    let usedChars = new Set();
    let attempts = 0;
    const maxAttempts = 5000;

    // Ensure at least one from each selected category (if length allows)
    const requiredChars = [];
    const categories = [
      { checked: elements.optUppercase.checked, set: CHAR_SETS.uppercase },
      { checked: elements.optLowercase.checked, set: CHAR_SETS.lowercase },
      { checked: elements.optNumbers.checked, set: CHAR_SETS.numbers },
      { checked: elements.optSymbols.checked, set: CHAR_SETS.symbols }
    ];

    for (const cat of categories) {
      if (!cat.checked) continue;
      let availableChars = cat.set;
      if (elements.optNoAmbiguous.checked) {
        availableChars = availableChars.split('').filter(c => !AMBIGUOUS_CHARS.includes(c)).join('');
      }
      const customExclude = elements.customExclude.value;
      if (customExclude.length > 0) {
        availableChars = availableChars.split('').filter(c => !customExclude.includes(c)).join('');
      }
      if (availableChars.length > 0) {
        const char = availableChars[secureRandom(availableChars.length)];
        requiredChars.push(char);
        if (noRepeat) usedChars.add(char);
      }
    }

    // Build the remaining password
    const remaining = length - requiredChars.length;

    for (let i = 0; i < remaining && attempts < maxAttempts; attempts++) {
      const char = pool[secureRandom(pool.length)];

      // Check no-repeat constraint
      if (noRepeat && usedChars.has(char)) continue;

      // Check no-sequential constraint
      if (noSequential && password.length > 0) {
        const lastChar = password[password.length - 1];
        if (isSequential(lastChar, char)) continue;
      }

      password.push(char);
      if (noRepeat) usedChars.add(char);
      i++;
    }

    if (password.length < remaining) {
      showError('Could not satisfy all constraints');
      return null;
    }

    // Combine required chars + remaining and shuffle
    password = [...requiredChars, ...password];
    password = secureShuffle(password);

    // Enforce begin-with-letter
    if (beginLetter) {
      const letterPool = getLetterPool();
      if (letterPool.length === 0) {
        showError('Enable uppercase or lowercase for "Start with Letter"');
        return null;
      }

      // Find a letter in the password and swap it to front, or replace first char
      const letterIndex = password.findIndex(c => letterPool.includes(c));
      if (letterIndex > 0) {
        [password[0], password[letterIndex]] = [password[letterIndex], password[0]];
      } else if (letterIndex === -1) {
        password[0] = letterPool[secureRandom(letterPool.length)];
      }
    }

    // Final sequential check pass (for shuffled result)
    if (noSequential) {
      for (let i = 1; i < password.length; i++) {
        if (isSequential(password[i - 1], password[i])) {
          // Try to find a non-sequential replacement
          let fixed = false;
          for (let a = 0; a < 100; a++) {
            const replacement = pool[secureRandom(pool.length)];
            if (noRepeat && usedChars.has(replacement) && replacement !== password[i]) continue;
            if (i > 0 && isSequential(password[i - 1], replacement)) continue;
            if (i < password.length - 1 && isSequential(replacement, password[i + 1])) continue;

            if (noRepeat) {
              usedChars.delete(password[i]);
              usedChars.add(replacement);
            }
            password[i] = replacement;
            fixed = true;
            break;
          }
        }
      }
    }

    return password.join('');
  }

  // --- Show error ---
  function showError(message) {
    const existingWarning = document.querySelector('.warning-message');
    if (existingWarning) existingWarning.remove();

    const warning = document.createElement('div');
    warning.className = 'warning-message';
    warning.textContent = message;
    elements.generateBtn.parentNode.insertBefore(warning, elements.generateBtn);

    elements.generateBtn.classList.add('shake');
    setTimeout(() => {
      elements.generateBtn.classList.remove('shake');
    }, 400);

    setTimeout(() => {
      warning.remove();
    }, 3000);
  }

  // --- Calculate password strength ---
  function calculateStrength(password) {
    if (!password) return { score: 0, label: '—', color: 'var(--text-muted)' };

    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;

    const entropy = password.length * Math.log2(poolSize || 1);

    // Check for patterns
    let patternPenalty = 0;
    const uniqueRatio = new Set(password).size / password.length;
    if (uniqueRatio < 0.5) patternPenalty += 15;

    const effectiveEntropy = Math.max(0, entropy - patternPenalty);

    if (effectiveEntropy < 28) return { score: 15, label: 'Weak', color: 'var(--strength-weak)' };
    if (effectiveEntropy < 36) return { score: 30, label: 'Fair', color: 'var(--strength-fair)' };
    if (effectiveEntropy < 60) return { score: 55, label: 'Good', color: 'var(--strength-good)' };
    if (effectiveEntropy < 80) return { score: 80, label: 'Strong', color: 'var(--strength-strong)' };
    return { score: 100, label: 'Excellent', color: 'var(--strength-excellent)' };
  }

  // --- Update strength display ---
  function updateStrength(password) {
    const strength = calculateStrength(password);
    elements.strengthBar.style.width = strength.score + '%';
    elements.strengthBar.style.backgroundColor = strength.color;
    elements.strengthText.textContent = strength.label;
    elements.strengthText.style.color = strength.color;
  }

  // --- Update password display ---
  function displayPassword(password) {
    if (password) {
      elements.passwordText.textContent = password;
      elements.passwordText.classList.remove('placeholder');
      elements.passwordText.classList.remove('fresh');
      // Force reflow for animation restart
      void elements.passwordText.offsetWidth;
      elements.passwordText.classList.add('fresh');
      currentPassword = password;
      updateStrength(password);
    }
  }

  // --- Copy to clipboard ---
  async function copyPassword() {
    if (!currentPassword) return;

    try {
      await navigator.clipboard.writeText(currentPassword);
      showToast();
      elements.copyBtn.classList.add('copied');
      setTimeout(() => elements.copyBtn.classList.remove('copied'), 1500);
    } catch (err) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = currentPassword;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast();
    }
  }

  // --- Show toast ---
  function showToast() {
    if (toastTimeout) clearTimeout(toastTimeout);
    elements.toast.classList.add('visible');
    toastTimeout = setTimeout(() => {
      elements.toast.classList.remove('visible');
    }, 1800);
  }

  // --- Sync slider & input ---
  function syncLength(source) {
    let value = parseInt(source === 'slider' ? elements.lengthSlider.value : elements.lengthInput.value, 10);

    if (isNaN(value)) value = 16;
    value = Math.max(6, Math.min(64, value));

    elements.lengthSlider.value = value;
    elements.lengthInput.value = value;

    updateSliderTrack();
  }

  // --- Update slider track fill ---
  function updateSliderTrack() {
    const value = elements.lengthSlider.value;
    const min = elements.lengthSlider.min;
    const max = elements.lengthSlider.max;
    const percent = ((value - min) / (max - min)) * 100;

    elements.lengthSlider.style.background = `linear-gradient(to right, 
      var(--accent-start) 0%, 
      var(--accent-end) ${percent}%, 
      var(--bg-tertiary) ${percent}%)`;
  }

  // --- Save settings to chrome.storage ---
  function saveSettings() {
    const settings = {
      length: parseInt(elements.lengthInput.value, 10),
      uppercase: elements.optUppercase.checked,
      lowercase: elements.optLowercase.checked,
      numbers: elements.optNumbers.checked,
      symbols: elements.optSymbols.checked,
      noRepeat: elements.optNoRepeat.checked,
      noAmbiguous: elements.optNoAmbiguous.checked,
      noSequential: elements.optNoSequential.checked,
      beginLetter: elements.optBeginLetter.checked,
      customExclude: elements.customExclude.value
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ keyforgeSettings: settings });
    }
  }

  // --- Load settings from chrome.storage ---
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('keyforgeSettings', (result) => {
        if (result.keyforgeSettings) {
          const s = result.keyforgeSettings;
          elements.lengthSlider.value = s.length || 16;
          elements.lengthInput.value = s.length || 16;
          elements.optUppercase.checked = s.uppercase !== false;
          elements.optLowercase.checked = s.lowercase !== false;
          elements.optNumbers.checked = s.numbers !== false;
          elements.optSymbols.checked = s.symbols !== false;
          elements.optNoRepeat.checked = !!s.noRepeat;
          elements.optNoAmbiguous.checked = !!s.noAmbiguous;
          elements.optNoSequential.checked = !!s.noSequential;
          elements.optBeginLetter.checked = !!s.beginLetter;
          elements.customExclude.value = s.customExclude || '';
          updateSliderTrack();
        }
        // Auto-generate on open
        handleGenerate();
      });
    } else {
      // Auto-generate when not in extension context
      handleGenerate();
    }
  }

  // --- Handle generate ---
  function handleGenerate() {
    // Clear previous warnings
    const existingWarning = document.querySelector('.warning-message');
    if (existingWarning) existingWarning.remove();

    const password = generatePassword();
    if (password) {
      displayPassword(password);
      saveSettings();
    }
  }

  // --- Event Listeners ---
  elements.generateBtn.addEventListener('click', handleGenerate);
  elements.refreshBtn.addEventListener('click', handleGenerate);
  elements.copyBtn.addEventListener('click', copyPassword);

  elements.lengthSlider.addEventListener('input', () => {
    syncLength('slider');
  });

  elements.lengthInput.addEventListener('input', () => {
    syncLength('input');
  });

  elements.lengthInput.addEventListener('blur', () => {
    syncLength('input');
  });

  // Save on any toggle change
  const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
  allCheckboxes.forEach(cb => {
    cb.addEventListener('change', saveSettings);
  });

  elements.customExclude.addEventListener('input', saveSettings);

  // Keyboard shortcut: Enter to generate
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement !== elements.customExclude) {
      handleGenerate();
    }
  });

  // --- Initialize ---
  elements.passwordText.classList.add('placeholder');
  updateSliderTrack();
  loadSettings();

})();
