// Shared: count figures up from zero (elements with data-count-to, data-count-decimals,
// data-count-prefix, data-count-suffix). Shows the final value at once when reduced motion is on.
function animateProgressCounters(root = document) {
  const counters = root.querySelectorAll('[data-count-to]:not([data-count-started])');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  counters.forEach((counter) => {
    counter.dataset.countStarted = 'true';
    const target = Number(counter.dataset.countTo);
    const decimals = Number(counter.dataset.countDecimals || 0);
    const prefix = counter.dataset.countPrefix || '';
    const suffix = counter.dataset.countSuffix || '';
    const duration = reducedMotion ? 0 : 1200;

    const render = (value) => {
      counter.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
    };

    if (!Number.isFinite(target) || duration === 0) {
      if (Number.isFinite(target)) render(target);
      return;
    }

    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      // Ease out gently, so the number starts visibly at zero and settles smoothly.
      const eased = 1 - ((1 - progress) ** 2);
      render(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };

    render(0);
    requestAnimationFrame(tick);
  });
}

animateProgressCounters();
