const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentTable = 'Consultation_scenario';

const tables = {
    'Consultation_scenario': '📋 Сценарии консультаций',
    'duty_room': '🚪 Duty room (дежурка)'
};

function showMessage(text, type) {
    let msgDiv = document.getElementById('message');
    if (!msgDiv) {
        const card = document.querySelector('.card');
        msgDiv = document.createElement('div');
        msgDiv.id = 'message';
        msgDiv.className = 'message';
        card.appendChild(msgDiv);
    }
    msgDiv.textContent = text;
    msgDiv.className = `message ${type}`;
    msgDiv.style.display = 'block';
    setTimeout(() => {
        if (msgDiv) msgDiv.style.display = 'none';
    }, 3000);
}

function toggleFormByTable(tableName) {
    const consultationForm = document.getElementById('consultationForm');
    const dutyForm = document.getElementById('dutyRoomForm');

    if (tableName === 'duty_room') {
        if (consultationForm) consultationForm.style.display = 'none';
        if (dutyForm) dutyForm.style.display = 'block';
    } else {
        if (consultationForm) consultationForm.style.display = 'block';
        if (dutyForm) dutyForm.style.display = 'none';
    }
}

async function loadRecords() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="3">Загрузка...</td></tr>';
    document.getElementById('currentTableTitle').textContent = tables[currentTable] || currentTable;

    const { data, error } = await sb
        .from(currentTable)
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="3" style="color: red;">Ошибка: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">Нет записей. Добавьте первую!</td></tr>';
        return;
    }

    if (currentTable === 'duty_room') {
        tbody.innerHTML = data.map(record => `
            <tr>
                <td><strong>${record.id}</strong></td>
                <td>
                    📅 <strong>Период:</strong> ${record.period}<br>
                    🔢 <strong>Количество:</strong> ${record.quantity}<br>
                    ${record.measures ? `📋 <strong>Меры:</strong> ${record.measures}<br>` : ''}
                    ${record.new_type ? `🆕 <strong>Вид:</strong> ${record.new_type}<br>` : ''}
                    ${record.new_solution ? `💡 <strong>Решение:</strong> ${record.new_solution}<br>` : ''}
                    ${record.error_link ? `⚠️ <strong>Ошибка:</strong> <a href="${record.error_link}" target="_blank">Ссылка</a><br>` : ''}
                    ${record.task_link ? `🚀 <strong>Задача:</strong> <a href="${record.task_link}" target="_blank">Ссылка</a>` : ''}
                </td>
                <td>
                    <button class="edit-btn" onclick="editRecord(${record.id})">✏️ Изменить</button>
                    <button class="delete-btn" onclick="deleteRecord(${record.id})">🗑️ Удалить</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = data.map(record => `
            <tr>
                <td><strong>${record.id}</strong></td>
                <td>
                    🔗 <a href="${record.link}" target="_blank">${record.link}</a><br>
                    💬 <strong>Комментарий:</strong> ${record.comment || '—'}
                </td>
                <td>
                    <button class="edit-btn" onclick="editRecord(${record.id})">✏️ Изменить</button>
                    <button class="delete-btn" onclick="deleteRecord(${record.id})">🗑️ Удалить</button>
                </td>
            </tr>
        `).join('');
    }
}

async function addConsultation(link, comment) {
    const { error } = await sb.from('Consultation_scenario').insert([{ link, comment: comment || null }]);
    if (error) {
        showMessage(`❌ Ошибка: ${error.message}`, 'error');
        return false;
    }
    showMessage('✅ Консультация добавлена!', 'success');
    loadRecords();
    return true;
}

async function addDutyRecord(period, quantity, measures, newType, newSolution, errorLink, taskLink) {
    const { error } = await sb.from('duty_room').insert([{
        period, quantity: parseInt(quantity), measures: measures || null,
        new_type: newType || null, new_solution: newSolution || null,
        error_link: errorLink || null, task_link: taskLink || null
    }]);
    if (error) {
        showMessage(`❌ Ошибка: ${error.message}`, 'error');
        return false;
    }
    showMessage('✅ Запись в дежурку добавлена!', 'success');
    loadRecords();
    return true;
}

window.deleteRecord = async function(id) {
    if (!confirm('Удалить запись?')) return;
    const { error } = await sb.from(currentTable).delete().eq('id', id);
    if (error) showMessage(`❌ Ошибка: ${error.message}`, 'error');
    else { showMessage('✅ Удалено', 'success'); loadRecords(); }
};

window.editRecord = async function(id) {
    const { data, error } = await sb.from(currentTable).select('*').eq('id', id).single();
    if (error) { showMessage('Ошибка загрузки', 'error'); return; }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';

    if (currentTable === 'duty_room') {
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Редактировать запись #${id}</h3>
                <input type="text" id="editPeriod" value="${data.period || ''}" placeholder="Период">
                <input type="number" id="editQuantity" value="${data.quantity || ''}" placeholder="Количество">
                <input type="text" id="editMeasures" value="${data.measures || ''}" placeholder="Меры">
                <input type="text" id="editNewType" value="${data.new_type || ''}" placeholder="Новый вид">
                <input type="text" id="editNewSolution" value="${data.new_solution || ''}" placeholder="Новое решение">
                <input type="url" id="editErrorLink" value="${data.error_link || ''}" placeholder="Ошибка (ссылка)">
                <input type="url" id="editTaskLink" value="${data.task_link || ''}" placeholder="Задача (ссылка)">
                <div class="button-group">
                    <button id="saveEditBtn">💾 Сохранить</button>
                    <button id="cancelEditBtn">❌ Отмена</button>
                </div>
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Редактировать запись #${id}</h3>
                <input type="url" id="editLink" value="${data.link || ''}" placeholder="Ссылка">
                <textarea id="editComment" rows="3" placeholder="Комментарий">${data.comment || ''}</textarea>
                <div class="button-group">
                    <button id="saveEditBtn">💾 Сохранить</button>
                    <button id="cancelEditBtn">❌ Отмена</button>
                </div>
            </div>
        `;
    }

    document.body.appendChild(modal);

    document.getElementById('saveEditBtn').onclick = async () => {
        if (currentTable === 'duty_room') {
            const updates = {
                period: document.getElementById('editPeriod').value,
                quantity: parseInt(document.getElementById('editQuantity').value),
                measures: document.getElementById('editMeasures').value || null,
                new_type: document.getElementById('editNewType').value || null,
                new_solution: document.getElementById('editNewSolution').value || null,
                error_link: document.getElementById('editErrorLink').value || null,
                task_link: document.getElementById('editTaskLink').value || null
            };
            const { error } = await sb.from('duty_room').update(updates).eq('id', id);
            if (error) showMessage(`Ошибка: ${error.message}`, 'error');
            else showMessage('✅ Обновлено', 'success');
        } else {
            const updates = {
                link: document.getElementById('editLink').value,
                comment: document.getElementById('editComment').value || null
            };
            const { error } = await sb.from('Consultation_scenario').update(updates).eq('id', id);
            if (error) showMessage(`Ошибка: ${error.message}`, 'error');
            else showMessage('✅ Обновлено', 'success');
        }
        modal.remove();
        loadRecords();
    };

    document.getElementById('cancelEditBtn').onclick = () => modal.remove();
};

async function loadCombinedReport() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '<tr><td colspan="3">Формирование общего списка...</td></tr>';
    document.getElementById('currentTableTitle').textContent = '📊 ОБЩИЙ СПИСОК (все таблицы)';

    let allRecords = [];
    const { data: consData } = await sb.from('Consultation_scenario').select('*');
    if (consData) allRecords.push(...consData.map(r => ({ ...r, source: 'Сценарии консультаций' })));

    const { data: dutyData } = await sb.from('duty_room').select('*');
    if (dutyData) allRecords.push(...dutyData.map(r => ({ ...r, source: 'Duty room' })));

    if (allRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">Нет записей</td></tr>';
        return;
    }

    tbody.innerHTML = allRecords.map(record => `
        <tr>
            <td><strong>${record.id}</strong><br><small>[${record.source}]</small></td>
            <td>${record.link ? `🔗 <a href="${record.link}" target="_blank">Ссылка</a><br>` : ''}
                ${record.period ? `📅 ${record.period}<br>🔢 Количество: ${record.quantity || '—'}<br>` : ''}
                ${record.comment ? `💬 ${record.comment}` : ''}
                ${record.measures ? `📋 Меры: ${record.measures}` : ''}
            </td>
            <td><button class="delete-btn" onclick="alert('Удаление из общего списка доступно в конкретной таблице')">❌ Удалить</button></td>
        </tr>
    `).join('');
}

document.getElementById('addConsultationBtn')?.addEventListener('click', async () => {
    const link = document.getElementById('consultationLink').value.trim();
    const comment = document.getElementById('consultationComment').value.trim();
    if (!link) { showMessage('❌ Введите ссылку', 'error'); return; }
    await addConsultation(link, comment);
    document.getElementById('consultationLink').value = '';
    document.getElementById('consultationComment').value = '';
});

document.getElementById('addDutyBtn')?.addEventListener('click', async () => {
    const period = document.getElementById('dutyPeriod').value.trim();
    const quantity = document.getElementById('dutyQuantity').value;
    if (!period || !quantity) { showMessage('❌ Заполните период и количество', 'error'); return; }
    await addDutyRecord(period, quantity,
        document.getElementById('dutyMeasures').value,
        document.getElementById('dutyNewType').value,
        document.getElementById('dutyNewSolution').value,
        document.getElementById('dutyErrorLink').value.trim(),
        document.getElementById('dutyTaskLink').value.trim());

    document.getElementById('dutyPeriod').value = '';
    document.getElementById('dutyQuantity').value = '';
    document.getElementById('dutyMeasures').value = '';
    document.getElementById('dutyNewType').value = '';
    document.getElementById('dutyNewSolution').value = '';
    document.getElementById('dutyErrorLink').value = '';
    document.getElementById('dutyTaskLink').value = '';
});

document.getElementById('switchTableBtn')?.addEventListener('click', () => {
    currentTable = document.getElementById('tableSelector').value;
    toggleFormByTable(currentTable);
    loadRecords();
});

document.getElementById('refreshBtn')?.addEventListener('click', () => loadRecords());
document.getElementById('combinedReportBtn')?.addEventListener('click', () => loadCombinedReport());

toggleFormByTable(currentTable);
loadRecords();