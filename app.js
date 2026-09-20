const chats = {
  anna: { name: 'Анна Белова', status: 'в сети' },
  team: { name: 'Studio Team', status: '4 участника в сети' },
  max: { name: 'Макс Орлов', status: 'был(а) недавно' },
  saved: { name: 'Избранное', status: 'Ваше личное пространство' },
  lena: { name: 'Елена Ким', status: 'была в сети 2 часа назад' }
};

const input = document.querySelector('#message-input');
const area = document.querySelector('#message-area');
const typing = document.querySelector('#typing');

document.querySelectorAll('.chat').forEach((chat) => {
  chat.addEventListener('click', () => {
    document.querySelector('.chat.active')?.classList.remove('active');
    chat.classList.add('active');
    const person = chats[chat.dataset.chat];
    document.querySelector('#contact-name').textContent = person.name;
    document.querySelector('#contact-status').textContent = person.status;
  });
});

document.querySelector('#composer').addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const message = document.createElement('article');
  message.className = 'message outgoing';
  message.innerHTML = `${text.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}<time>сейчас <span>✓✓</span></time>`;
  area.insertBefore(message, typing);
  input.value = '';
  area.scrollTop = area.scrollHeight;
  typing.classList.add('visible');
  window.setTimeout(() => typing.classList.remove('visible'), 1800);
});
