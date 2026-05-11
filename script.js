// Paste your Founder-Cohort Google Apps Script Web App URL once deployed
const SHEET_URL = '';

const form = document.getElementById('applicationForm');
const successMessage = document.getElementById('successMessage');
const submitBtn = form.querySelector('.submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    xHandle: form.xHandle.value.trim(),
    tg: form.tg.value.trim(),
    company: form.company.value.trim(),
    companyX: form.companyX.value.trim(),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    if (SHEET_URL) {
      await fetch(SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } else {
      console.log('Application submitted (no sheet URL configured):', data);
    }

    form.classList.add('hidden');
    successMessage.classList.remove('hidden');
  } catch (err) {
    console.error('Submission error:', err);
    submitBtn.textContent = 'Something went wrong. Try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit application';
  }
});

function resetForm() {
  form.reset();
  form.classList.remove('hidden');
  successMessage.classList.add('hidden');
}
