(() => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const themeLabel = document.getElementById('themeLabel');

  const savedTheme = sessionStorage.getItem('ledger-theme') || 'vault';
  root.setAttribute('data-theme', savedTheme);
  themeLabel.textContent = savedTheme === 'vault' ? 'Vault' : 'Paper';

  themeToggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'vault' ? 'paper' : 'vault';
    root.setAttribute('data-theme', next);
    themeLabel.textContent = next === 'vault' ? 'Vault' : 'Paper';
    try { sessionStorage.setItem('ledger-theme', next); } catch (e) {}
  });

  const form = document.getElementById('riskForm');
  const submitBtn = document.getElementById('submitBtn');
  const formError = document.getElementById('formError');
  const recalcBtn = document.getElementById('recalcPct');

  const incomeEl = document.getElementById('person_income');
  const amountEl = document.getElementById('loan_amnt');
  const pctEl = document.getElementById('loan_percent_income');

  recalcBtn.addEventListener('click', () => {
    const income = parseFloat(incomeEl.value);
    const amount = parseFloat(amountEl.value);
    if (income > 0 && amount >= 0) {
      pctEl.value = (amount / income).toFixed(2);
    }
  });

  // ---- Gauge ----
  const ARC_LENGTH = 377;
  const gaugeFill = document.getElementById('gaugeFill');
  const gaugeNeedle = document.getElementById('gaugeNeedle');
  const probNumber = document.getElementById('probNumber');
  const verdictBadge = document.getElementById('verdictBadge');
  const verdictText = document.getElementById('verdictText');
  const verdictSub = document.getElementById('verdictSub');
  const thresholdValue = document.getElementById('thresholdValue');
  const lineLTI = document.getElementById('lineLTI');
  const lineRate = document.getElementById('lineRate');
  const lineHist = document.getElementById('lineHist');

  function hexToRgb(hex) {
    const v = hex.trim().replace('#', '');
    const n = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) { return a.map((c, i) => Math.round(c + (b[i] - c) * t)); }
  function rgbToCss(rgb) { return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; }

  function riskColor(p) {
    const styles = getComputedStyle(root);
    const low = hexToRgb(styles.getPropertyValue('--risk-low'));
    const mid = hexToRgb(styles.getPropertyValue('--risk-mid'));
    const high = hexToRgb(styles.getPropertyValue('--risk-high'));
    if (p <= 0.5) return rgbToCss(mix(low, mid, p / 0.5));
    return rgbToCss(mix(mid, high, (p - 0.5) / 0.5));
  }

  function animateNumber(target, el, ms = 900) {
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (target * eased * 100).toFixed(1) + '%';
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderResult(probability, prediction, threshold) {
    const p = Math.max(0, Math.min(1, probability));
    const color = riskColor(p);

    gaugeFill.style.strokeDashoffset = String(ARC_LENGTH * (1 - p));
    gaugeFill.style.stroke = color;
    gaugeNeedle.style.transform = `rotate(${-90 + 180 * p}deg)`;
    gaugeNeedle.querySelector('line').style.stroke = color;
    gaugeNeedle.querySelector('circle').style.fill = color;

    animateNumber(p, probNumber);
    thresholdValue.textContent = (threshold * 100).toFixed(0) + '%';

    verdictBadge.classList.remove('low', 'high');
    if (prediction === 1) {
      verdictBadge.classList.add('high');
      verdictText.textContent = 'High risk';
      verdictSub.textContent = 'This file sits above the desk\u2019s decision line.';
    } else {
      verdictBadge.classList.add('low');
      verdictText.textContent = 'Low risk';
      verdictSub.textContent = 'This file sits below the desk\u2019s decision line.';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;
    submitBtn.classList.add('is-loading');
    submitBtn.querySelector('span').textContent = 'Reading file\u2026';

    const payload = {
      person_age: parseInt(document.getElementById('person_age').value, 10),
      person_income: parseFloat(incomeEl.value),
      person_home_ownership: document.getElementById('person_home_ownership').value,
      person_emp_length: parseFloat(document.getElementById('person_emp_length').value),
      loan_intent: document.getElementById('loan_intent').value,
      loan_grade: document.getElementById('loan_grade').value,
      loan_amnt: parseFloat(amountEl.value),
      loan_int_rate: parseFloat(document.getElementById('loan_int_rate').value),
      loan_percent_income: parseFloat(pctEl.value),
      cb_person_default_on_file: document.getElementById('cb_person_default_on_file').value,
      cb_person_cred_hist_length: parseInt(document.getElementById('cb_person_cred_hist_length').value, 10)
    };

    try {
      const res = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      renderResult(data.default_probability, data.default_prediction, data.threshold);

      lineLTI.textContent = (payload.loan_percent_income * 100).toFixed(1) + '%';
      lineRate.textContent = payload.loan_int_rate.toFixed(1) + '% \u00b7 grade ' + payload.loan_grade;
      lineHist.textContent = payload.cb_person_cred_hist_length + ' yrs';
    } catch (err) {
      formError.hidden = false;
      formError.textContent = 'Could not reach the model: ' + err.message;
    } finally {
      submitBtn.classList.remove('is-loading');
      submitBtn.querySelector('span').textContent = 'Assess risk';
    }
  });
})();
