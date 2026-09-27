const audio = document.getElementById('audio');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const volume = document.getElementById('volume');
const waveform = document.getElementById('waveform');
const favoriteBtn = document.getElementById('favoriteBtn');
const toast = document.getElementById('toast');

for (let i = 0; i < 32; i += 1) {
  const bar = document.createElement('i');
  const height = 10 + ((i * 17) % 33);
  bar.style.height = `${height}px`;
  if (i < 17) bar.classList.add('live');
  waveform.appendChild(bar);
}

audio.volume = 0.72;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

async function togglePlay() {
  if (audio.paused) {
    try {
      await audio.play();
      playIcon.textContent = 'Ⅱ';
      playBtn.setAttribute('aria-label', 'Пауза');
    } catch (error) {
      showToast('Браузер не дал запустить демо-аудио. Нажми Play ещё раз.');
    }
  } else {
    audio.pause();
    playIcon.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Воспроизвести');
  }
}

playBtn.addEventListener('click', togglePlay);
audio.addEventListener('ended', () => { playIcon.textContent = '▶'; });
volume.addEventListener('input', (event) => {
  const value = Number(event.target.value);
  audio.volume = value / 100;
  event.target.style.background = `linear-gradient(90deg,#fff 0 ${value}%,#303442 ${value}%)`;
});
favoriteBtn.addEventListener('click', () => {
  favoriteBtn.classList.toggle('active');
  favoriteBtn.textContent = favoriteBtn.classList.contains('active') ? '♥' : '♡';
});

document.getElementById('prevBtn').addEventListener('click', () => showToast('История треков подключена к демо-интерфейсу.'));
document.getElementById('nextBtn').addEventListener('click', () => showToast('Следующий трек управляется эфирной автоматизацией.'));
document.getElementById('searchBtn').addEventListener('click', () => showToast('Поиск добавим на следующем этапе.'));
document.getElementById('airBtn').addEventListener('click', () => showToast('Форма сообщений в эфир будет подключена к backend.'));
document.getElementById('joinBtn').addEventListener('click', () => showToast('Форма сообщений в эфир будет подключена к backend.'));
