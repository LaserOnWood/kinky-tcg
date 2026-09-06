const cards = document.querySelectorAll('.holo-card');
const intensityToggle = document.getElementById('intensity-toggle');
const root = document.body;

function resetCard(card) {
  card.style.setProperty('--pointer-x', '50%');
  card.style.setProperty('--pointer-y', '50%');
  card.style.setProperty('--tilt-x', '0deg');
  card.style.setProperty('--tilt-y', '0deg');
}

function updateCard(card, clientX, clientY) {
  const bounds = card.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
  const y = Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height));
  const tiltY = (x - .5) * 11;
  const tiltX = (y - .5) * -11;

  card.style.setProperty('--pointer-x', `${(x * 100).toFixed(1)}%`);
  card.style.setProperty('--pointer-y', `${(y * 100).toFixed(1)}%`);
  card.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
  card.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
}

cards.forEach((card) => {
  resetCard(card);

  card.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch') updateCard(card, event.clientX, event.clientY);
  });

  card.addEventListener('pointerleave', () => resetCard(card));
  card.addEventListener('focus', () => {
    card.style.setProperty('--pointer-x', '72%');
    card.style.setProperty('--pointer-y', '22%');
    card.style.setProperty('--tilt-x', '-3deg');
    card.style.setProperty('--tilt-y', '3deg');
  });
  card.addEventListener('blur', () => resetCard(card));

  card.addEventListener('pointerdown', (event) => {
    updateCard(card, event.clientX, event.clientY);
  });
});

intensityToggle.addEventListener('click', () => {
  const enabled = root.classList.toggle('intensity-max');
  intensityToggle.setAttribute('aria-pressed', String(enabled));
  intensityToggle.querySelector('span').textContent = enabled
    ? 'Revenir à l’intensité standard'
    : 'Activer l’intensité maximale';
});
