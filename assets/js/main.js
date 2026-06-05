document.addEventListener('DOMContentLoaded', () => {
  const burgerMenu = document.getElementById('burger-menu');
  const topbarNav = document.getElementById('topbar-nav');

  if (burgerMenu && topbarNav) {
    burgerMenu.addEventListener('click', () => {
      topbarNav.classList.toggle('open');
      const open = topbarNav.classList.contains('open');
      burgerMenu.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });

    topbarNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        topbarNav.classList.remove('open');
        burgerMenu.innerHTML = '<i class="fa-solid fa-bars"></i>';
      });
    });
  }

  const navLinks = [...document.querySelectorAll('.topbar-nav a[href^="#"]')];
  const sections = [...document.querySelectorAll('main section[id]')];

  function updateActiveNav() {
    const y = window.scrollY + 140;
    const current = sections.findLast((section) => section.offsetTop <= y);
    if (!current) return;

    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current.id}`);
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  const statsSection = document.getElementById('stats-ribbon');
  let statsAnimated = false;

  function animateNumber(el) {
    const target = Number(el.dataset.target || 0);
    const duration = 1200;
    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString('fr-FR');
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !statsAnimated) {
        document.querySelectorAll('.stat-num').forEach(animateNumber);
        statsAnimated = true;
      }
    });
  }, { threshold: 0.35 });

  if (statsSection) observer.observe(statsSection);

  const codeSnippets = {
    sensors: {
      file: 'sensors.ino',
      exp: 'Les capteurs infrarouges sont lus en continu. Chaque valeur est normalisee pour estimer la position de la ligne sous le robot.',
      code: `<span class="code-comment">// Lecture des 5 capteurs infrarouges</span>
<span class="code-type">const int</span> sensorPins[5] = {A0, A1, A2, A3, A4};
<span class="code-type">int</span> sensorValues[5];

<span class="code-type">void</span> <span class="code-func">readSensors</span>() {
  <span class="code-keyword">for</span> (<span class="code-type">int</span> i = 0; i &lt; 5; i++) {
    sensorValues[i] = <span class="code-func">analogRead</span>(sensorPins[i]);
  }
}`
    },
    motors: {
      file: 'motors.ino',
      exp: 'Le driver TB6612FNG transforme les commandes calculees en signaux PWM et directions pour les deux moteurs.',
      code: `<span class="code-comment">// Controle differentiel des deux roues</span>
<span class="code-type">void</span> <span class="code-func">setMotors</span>(<span class="code-type">int</span> left, <span class="code-type">int</span> right) {
  left = <span class="code-func">constrain</span>(left, -255, 255);
  right = <span class="code-func">constrain</span>(right, -255, 255);

  <span class="code-func">setMotorA</span>(left);
  <span class="code-func">setMotorB</span>(right);
}`
    },
    pid: {
      file: 'pid.ino',
      exp: 'Le PID combine correction immediate, memoire de l erreur et anticipation pour garder le robot centre sur la ligne.',
      code: `<span class="code-type">float</span> Kp = 15.0;
<span class="code-type">float</span> Ki = 0.05;
<span class="code-type">float</span> Kd = 8.0;
<span class="code-type">float</span> lastError = 0;
<span class="code-type">float</span> integral = 0;

<span class="code-type">float</span> <span class="code-func">computePID</span>(<span class="code-type">float</span> error) {
  integral += error;
  <span class="code-type">float</span> derivative = error - lastError;
  lastError = error;

  <span class="code-keyword">return</span> Kp * error + Ki * integral + Kd * derivative;
}`
    },
    obstacles: {
      file: 'obstacles.ino',
      exp: 'Le sonar surveille l avant du robot. Si un obstacle est proche, la trajectoire normale est interrompue.',
      code: `<span class="code-comment">// Priorite a la securite</span>
<span class="code-type">void</span> <span class="code-func">checkObstacle</span>() {
  <span class="code-type">float</span> distance = <span class="code-func">readUltrasonic</span>();

  <span class="code-keyword">if</span> (distance &lt; 15) {
    <span class="code-func">setMotors</span>(0, 0);
    <span class="code-func">avoidObstacle</span>();
  }
}`
    }
  };

  const tabButtons = document.querySelectorAll('.tab-btn');
  const codeFileName = document.getElementById('code-file-name');
  const codeContent = document.getElementById('code-content');
  const codeExplanation = document.getElementById('code-explanation-text');

  function setCodeTab(tab) {
    const snippet = codeSnippets[tab];
    if (!snippet || !codeFileName || !codeContent || !codeExplanation) return;

    tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
    codeFileName.textContent = snippet.file;
    codeContent.innerHTML = snippet.code;
    codeExplanation.textContent = snippet.exp;
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setCodeTab(button.dataset.tab));
  });
  setCodeTab('sensors');

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeLightbox = document.getElementById('lightbox-close');
  const schematicButton = document.getElementById('btn-zoom-schematic');

  if (lightbox && lightboxImg instanceof HTMLImageElement && schematicButton) {
    schematicButton.addEventListener('click', () => {
      const img = schematicButton.querySelector('img');
      if (!(img instanceof HTMLImageElement)) return;
      lightboxImg.src = img.src;
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    });

    const close = () => {
      lightbox.classList.remove('open');
      lightboxImg.src = '';
      document.body.style.overflow = '';
    };

    closeLightbox?.addEventListener('click', close);
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) close();
    });
  }

  if (typeof window.Chart !== 'undefined') {
    Chart.defaults.color = '#667085';
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

    const lapCanvas = document.getElementById('chart-lap-times');
    if (lapCanvas) {
      new Chart(lapCanvas, {
        type: 'line',
        data: {
          labels: ['Run 1', 'Run 2', 'Run 3', 'Run 4', 'Run 5', 'Run 6'],
          datasets: [{
            label: 'Temps au tour (s)',
            data: [15.2, 14.3, 13.6, 12.8, 11.7, 10.9],
            borderColor: '#0f6bff',
            backgroundColor: 'rgba(15, 107, 255, 0.12)',
            fill: true,
            tension: 0.35
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    const errorCanvas = document.getElementById('chart-error-speeds');
    if (errorCanvas) {
      new Chart(errorCanvas, {
        type: 'bar',
        data: {
          labels: ['1.0 m/s', '1.5 m/s', '2.0 m/s', '2.5 m/s'],
          datasets: [{
            label: 'Ecart moyen (mm)',
            data: [2.1, 3.4, 5.8, 8.2],
            backgroundColor: '#00a6a6'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
  }

  const resultsSection = document.getElementById('results-section');
  if (resultsSection) {
    const barsObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        document.querySelectorAll('.perf-metric i').forEach((bar) => {
          bar.style.width = `${bar.dataset.width || 0}%`;
        });
        barsObserver.disconnect();
      });
    }, { threshold: 0.35 });
    barsObserver.observe(resultsSection);
  }

  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');

  if (contactForm instanceof HTMLFormElement && formStatus) {
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const values = ['contact-name', 'contact-email', 'contact-subject', 'contact-message']
        .map((id) => document.getElementById(id))
        .map((field) => field && 'value' in field ? String(field.value).trim() : '');

      if (values.some((value) => !value)) {
        formStatus.textContent = 'Veuillez remplir tous les champs.';
        formStatus.className = 'form-status error';
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[1])) {
        formStatus.textContent = 'Veuillez entrer une adresse email valide.';
        formStatus.className = 'form-status error';
        return;
      }

      formStatus.textContent = 'Message pret a etre transmis a la Team The Winners.';
      formStatus.className = 'form-status success';
      contactForm.reset();
    });
  }

  if (typeof window.initPIDSimulator === 'function') {
    window.initPIDSimulator();
  }
});
