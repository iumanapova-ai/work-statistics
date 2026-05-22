// script.js
// Создаём клиент Supabase из переменных, объявленных в config.js
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase готов');

function showMessage(text, type) {
    const msgDiv = document.getElementById('message');
    if (!msgDiv) return;
    msgDiv.textContent = text;
    msgDiv.className = `message ${type}`;
    msgDiv.style.display = 'block';
    setTimeout(() => {
        if (msgDiv) msgDiv.style.display = 'none';
    }, 3000);
}

async function loadRecords() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Загрузка...</td></tr>';

    const { data, error } = await supabase
        .from('Consultation_scenario')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Ошибка загрузки:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Ошибка загрузки: ' + error.message + '</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Нет записей. Добавьте первую!</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(record => `
        <tr>
            <td>${new Date(record.date).toLocaleString('ru-RU')}</td>
            <td><a href="${record.link}" target="_blank">${record.link.substring(0, 50)}${record.link.length > 50 ? '...' : ''}</a></td>
            <td>${record.comment || '—'}</td>
            <td><button class="delete-btn" onclick="deleteRecord(${record.id})">Удалить</button></td>
        </tr>
    `).join('');
}

async function addRecord(date, link, comment) {
    const { data, error } = await supabase
        .from('Consultation_scenario')
        .insert([{ date: date, link: link, comment: comment || null }]);

    if (error) {
        console.error('Ошибка:', error);
        if (error.code === '23505') {
            showMessage('❌ Такая ссылка уже существует!', 'error');
        } else {
            showMessage('❌ Ошибка: ' + error.message, 'error');
        }
        return false;
    }

    showMessage('✅ Запись добавлена!', 'success');
    loadRecords();
    return true;
}

window.deleteRecord = async function(id) {
    if (!confirm('Удалить запись?')) return;
    const { error } = await supabase.from('Consultation_scenario').delete().eq('id', id);
    if (error) {
        showMessage('❌ Ошибка удаления: ' + error.message, 'error');
    } else {
        showMessage('✅ Запись удалена', 'success');
        loadRecords();
    }
};

const form = document.getElementById('consultationForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('date').value;
        const link = document.getElementById('link').value.trim();
        const comment = document.getElementById('comment').value.trim();

        if (!date) { showMessage('❌ Укажите дату', 'error'); return; }
        if (!link) { showMessage('❌ Введите ссылку', 'error'); return; }
        if (!link.startsWith('http://') && !link.startsWith('https://')) {
            showMessage('❌ Ссылка должна начинаться с http:// или https://', 'error');
            return;
        }

        await addRecord(date, link, comment);
        form.reset();
    });
}

const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadRecords());
}

loadRecords();