const form = document.getElementById('applicationForm');
const successMessage = document.getElementById('successMessage');
const submitBtn = form.querySelector('.submit-btn');
const errorEl = document.getElementById('formError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }

  const data = {
    xHandle: form.xHandle.value.trim(),
    tg: form.tg.value.trim(),
    company: form.company.value.trim(),
    companyX: form.companyX.value.trim(),
    // Honeypot — must remain empty. Bots fill it; the server silently drops those.
    website: form.website ? form.website.value : '',
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
    form.classList.add('hidden');
    successMessage.classList.remove('hidden');
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Something went wrong. Try again.';
      errorEl.classList.remove('hidden');
    }
    submitBtn.textContent = 'Try again';
  } finally {
    submitBtn.disabled = false;
    if (!successMessage.classList.contains('hidden')) return;
    submitBtn.textContent = submitBtn.textContent === 'Try again' ? 'Try again' : 'Submit application';
  }
});

document.getElementById('resetBtn')?.addEventListener('click', () => {
  form.reset();
  form.classList.remove('hidden');
  successMessage.classList.add('hidden');
  if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
});
