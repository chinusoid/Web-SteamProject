// Validate each important field using the explicit JavaScript rules in validation.js.
document.querySelectorAll('[data-demo-form]').forEach((form) => {
  const rules = window.HUB_VALIDATE.formRules[form.id];
  const fields = Object.keys(rules).map(name => form.elements.namedItem(name));
  const status = form.querySelector('.form-status');
  let submitted = false;

  // Final project: all constraints are checked in JavaScript, with inline feedback.
  form.noValidate = true;
  fields.forEach((field) => {
    field.setAttribute('aria-required', 'true');
    const error = document.createElement('p');
    error.id = `${field.id}-error`;
    error.className = 'field-error small mt-2 mb-0';
    error.hidden = true;
    const group = field.closest('.input-group, .form-check') || field;
    group.insertAdjacentElement('afterend', error);
    field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), error.id]
      .filter(Boolean).join(' '));
  });

  const validate = (field) => {
    const message = rules[field.name](field);
    const error = document.getElementById(`${field.id}-error`);
    error.textContent = message;
    error.hidden = !message;
    field.classList.toggle('is-invalid', Boolean(message));
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
    return !message;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitted = true;
    const invalidFields = fields.filter((field) => !validate(field));
    status.dataset.state = invalidFields.length ? 'error' : 'success';
    if (invalidFields.length) {
      status.textContent = `Please correct ${invalidFields.length} ${invalidFields.length === 1 ? 'field' : 'fields'} and try again.`;
      invalidFields[0].focus();
      return;
    }
    status.textContent = form.dataset.successMessage || (form.classList.contains('contact-form')
      ? 'Your message is valid. This is a demo form; no message has been sent.'
      : 'Your email is valid. This is a demo form; no subscription has been created.');
    form.dispatchEvent(new CustomEvent('hub:form-valid'));
  });

  const updateField = (event) => {
    status.textContent = '';
    if (!submitted) return;
    if (fields.includes(event.target)) validate(event.target);
  };
  form.addEventListener('input', updateField);
  form.addEventListener('change', updateField);
  form.addEventListener('reset', () => {
    submitted = false;
    status.textContent = '';
    delete status.dataset.state;
    fields.forEach((field) => {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
      const error = document.getElementById(`${field.id}-error`);
      error.textContent = '';
      error.hidden = true;
    });
  });
});

// Accessible buttons toggle the answers; CSS animates their height.
document.querySelectorAll('[data-accordion-button]').forEach((button) => {
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    panel.classList.toggle('is-open', expanded);
    panel.inert = !expanded;
  });
});

// Native dialog makes the page inert and supports Escape-to-close.
document.querySelectorAll('[data-open-dialog]').forEach((button) => {
  const dialog = document.getElementById(button.dataset.openDialog);
  button.addEventListener('click', () => {
    dialog.showModal();
    document.body.classList.add('dialog-open');
  });
});
document.querySelectorAll('[data-subscription-dialog]').forEach((dialog) => {
  // Keep Tab and Shift+Tab cycling through the popup's controls.
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
      .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  const outsideDialog = (event) => {
    const bounds = dialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  let startedOutside = false;
  dialog.addEventListener('pointerdown', (event) => {
    startedOutside = outsideDialog(event);
  });
  dialog.addEventListener('click', (event) => {
    if (startedOutside && outsideDialog(event)) dialog.close();
  });
  dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
});

// Cycle through a readable dark palette by changing the body's CSS.
const backgroundButton = document.querySelector('[data-change-background]');
if (backgroundButton) {
  const backgrounds = [
    { name: 'Midnight', color: '#101820' },
    { name: 'Ocean', color: '#17283b' },
    { name: 'Plum', color: '#261d38' },
    { name: 'Forest', color: '#16342e' },
  ];
  let currentBackground = 0;
  document.addEventListener('hub:theme-change', () => {
    currentBackground = 0;
    document.querySelector('[data-background-name]').textContent = 'Midnight';
    backgroundButton.querySelector('.background-swatch').style.backgroundColor = document.documentElement.dataset.bsTheme === 'light' ? '#eff4f8' : '#101820';
  });
  backgroundButton.addEventListener('click', () => {
    currentBackground = (currentBackground + 1) % backgrounds.length;
    const background = backgrounds[currentBackground];
    document.body.style.background = document.documentElement.dataset.bsTheme === 'light'
      ? ['#eff4f8', '#e7f2fb', '#f1eafa', '#e5f4ed'][currentBackground] : background.color;
    document.querySelector('[data-background-name]').textContent = background.name;
    backgroundButton.querySelector('.background-swatch').style.backgroundColor = background.color;
  });
}

// Show local time immediately, then refresh it once per second.
const clocks = document.querySelectorAll('[data-live-clock]');
if (clocks.length) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  });
  const updateClock = () => {
    const now = new Date();
    clocks.forEach((clock) => {
      clock.dateTime = now.toISOString();
      // Uses the selected EN/RU/KZ locale when js/i18n.js is present.
      clock.textContent = window.HUB_I18N?.localizedDateTime(now, window.HUB_I18N.language) || formatter.format(now);
    });
  };
  updateClock();
  document.addEventListener('hub:languagechange', updateClock);
  setInterval(updateClock, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateClock();
  });
}

// No autoplay: users control the carousel. Announce manually selected slides.
document.querySelectorAll('.carousel').forEach((carousel) => {
  const slides = carousel.querySelectorAll('.carousel-item');
  const updateSlides = () => slides.forEach((slide) => {
    slide.setAttribute('aria-hidden', String(!slide.classList.contains('active')));
  });
  updateSlides();
  carousel.addEventListener('slid.bs.carousel', (event) => {
    updateSlides();
    const status = carousel.parentElement.querySelector('.carousel-status');
    status.textContent = `Image ${event.to + 1} of ${slides.length}: ${slides[event.to].querySelector('h3').textContent.trim()}`;
  });
});
