// script.js
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentTable = 'Consultation_scenario';
let currentFilter = '';

const tables = {
    'Consultation_scenario': '📋 Сценарии консультаций',
    'duty_room': '🚪 Duty room (дежурка)'
};

function showMessage(text, type) {
    let msgDiv = document.getElementById('message');
    if (!msgDiv) return;
    msgDiv.textContent = text;
    msgDiv.className = `message ${type}`;
    msgDiv.style.display = 'block';
    setTimeout(() => {
        if (msgDiv) msgDiv.style.display = 'none';
    }, 3000);
}

// ========== РАБОТА С МЕРАМИ ==========

function addMeasureBlock(measureData = null) {
    const container = document.getElementById('measuresContainer');
    if (!container) return;

    const blockDiv = document.createElement('div');
    blockDiv.className = 'measure-card';

    blockDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>📌 Мера</strong>
            <button type="button" class="remove-measure-btn" style="background: #dc3545; color: white; padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer;" onclick="this.closest('.measure-card').remove()">✖️ Удалить</button>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            <input type="text" class="measure-new-type" placeholder="Новый вид" style="flex: 1; min-width: 150px; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;" value="${measureData?.new_type || ''}">
            <input type="text" class="measure-new-solution" placeholder="Новое решение" style="flex: 1; min-width: 150px; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;" value="${measureData?.new_solution || ''}">
            <input type="url" class="measure-task-link" placeholder="Задача в разработку (ссылка)" style="flex: 1; min-width: 200px; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;" value="${measureData?.task_link || ''}">
            <input type="url" class="measure-error-link" placeholder="Ошибка (ссылка)" style="flex: 1; min-width: 200px; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;" value="${measureData?.error_link || ''}">
        </div>
    `;

    container.appendChild(blockDiv);
}

function collectMeasures() {
    const measures = [];
    document.querySelectorAll('#measuresContainer .measure-card').forEach(card => {
        const new_type = card.querySelector('.measure-new-type')?.value;
        const new_solution = card.querySelector('.measure-new-solution')?.value;
        const task_link = card.querySelector('.measure-task-link')?.value;
        const error_link = card.querySelector('.measure-error-link')?.value;

        if (new_type || new_solution || task_link || error_link) {
            measures.push({
                new_type: new_type || '',
                new_solution: new_solution || '',
                task_link: task_link || '',
                error_link: error_link || ''
            });
        }
    });
    return measures;
}

function toggleFormByTable(tableName) {
    const consultationForm = document.getElementById('consultationForm');
    const dutyForm = document.getElementById('dutyRoomForm');
    const filterBlock = document.getElementById('periodFilterBlock');

    if (tableName === 'duty_room') {
        if (consultationForm) consultationForm.style.display = 'none';
        if (dutyForm) dutyForm.style.display = 'block';
        if (filterBlock) filterBlock.style.display = 'block';
    } else {
        if (consultationForm) consultationForm.style.display = 'block';
        if (dutyForm) dutyForm.style.display = 'none';
        if (filterBlock) filterBlock.style.display = 'none';
    }
}

async function loadRecords() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Загрузка...<\/td><\/tr>';
    document.getElementById('currentTableTitle').innerHTML = tables[currentTable] || currentTable;

    if (currentTable === 'duty_room') {
        let query = sb.from('duty_room').select('*').order('id', { ascending: false });
        if (currentFilter) {
            query = query.ilike('period', `%${currentFilter}%`);
        }
        const { data, error } = await query;

        if (error) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Ошибка: ${error.message}<\/td><\/tr>`;
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Нет записей. Добавьте первую!<\/td><\/tr>';
            return;
        }

        tbody.innerHTML = data.map(record => {
            let measuresHtml = '';
            if (record.measures && record.measures.length > 0) {
                measuresHtml = '<ul style="margin: 5px 0 0 15px;">' +
                    record.measures.map(m => `
                        <li>
                            <strong>Новый вид:</strong> ${m.new_type || '—'}<br>
                            <strong>Новое решение:</strong> ${m.new_solution || '—'}
                            ${m.task_link ? `<br>🚀 <a href="${m.task_link}" target="_blank">Задача в разработку</a>` : ''}
                            ${m.error_link ? `<br>⚠️ <a href="${m.error_link}" target="_blank">Ошибка</a>` : ''}
                        </li>
                    `).join('') +
                    '</ul>';
            }

            return `
                <tr>
                    <td><strong>${record.id}</strong></td>
                    <td>
                        📅 <strong>Период:</strong> ${record.period_from && record.period_to ? `${record.period_from} — ${record.period_to}` : record.period}<br>
                        🔢 <strong>Количество:</strong> ${record.quantity}<br>
                        📋 <strong>Меры:</strong> ${measuresHtml || '—'}
                    </td>
                    <td>
                        <button class="edit-btn" onclick="editRecord(${record.id})">✏️ Изменить</button>
                        <button class="delete-btn" onclick="deleteRecord(${record.id})">🗑️ Удалить</button>
                    </td>
                </tr>
            `;
        }).join('');

    } else {
        const { data, error } = await sb.from('Consultation_scenario').select('*').order('id', { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Ошибка: ${error.message}<\/td><\/tr>`;
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Нет записей. Добавьте первую!<\/td><\/tr>';
            return;
        }

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

async function addDutyRecord(periodFrom, periodTo, quantity, measuresArray) {
    const periodText = `${periodFrom} — ${periodTo}`;

    const { error } = await sb.from('duty_room').insert([{
        period_from: periodFrom,
        period_to: periodTo,
        period: periodText,
        quantity: parseInt(quantity),
        measures: measuresArray,
        created_at: new Date().toISOString()
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
    if (error) {
        showMessage(`❌ Ошибка: ${error.message}`, 'error');
    } else {
        showMessage('✅ Удалено', 'success');
        loadRecords();
    }
};

window.editRecord = async function(id) {
    const { data, error } = await sb.from(currentTable).select('*').eq('id', id).single();
    if (error) {
        showMessage('Ошибка загрузки', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';

    if (currentTable === 'duty_room') {
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Редактировать запись #${id}</h3>
                <input type="date" id="editPeriodFrom" value="${data.period_from || ''}" placeholder="Период от">
                <input type="date" id="editPeriodTo" value="${data.period_to || ''}" placeholder="Период до">
                <input type="number" id="editQuantity" value="${data.quantity || ''}" placeholder="Количество">
                <textarea id="editMeasures" rows="5" placeholder="Меры (JSON)">${JSON.stringify(data.measures || [], null, 2)}</textarea>
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
            let measuresVal = null;
            try {
                const measuresInput = document.getElementById('editMeasures').value;
                if (measuresInput) measuresVal = JSON.parse(measuresInput);
            } catch(e) { measuresVal = null; }

            const updates = {
                period_from: document.getElementById('editPeriodFrom').value,
                period_to: document.getElementById('editPeriodTo').value,
                quantity: parseInt(document.getElementById('editQuantity').value),
                measures: measuresVal
            };
            updates.period = `${updates.period_from} — ${updates.period_to}`;

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
    tbody.innerHTML = '<td><td colspan="3" style="text-align: center;">Формирование общего списка...<\/td><\/tr>';
    document.getElementById('currentTableTitle').innerHTML = '📊 ОБЩИЙ СПИСОК (все таблицы)';

    let allRecords = [];
    const { data: consData } = await sb.from('Consultation_scenario').select('*');
    if (consData) allRecords.push(...consData.map(r => ({ ...r, source: 'Сценарии консультаций' })));

    const { data: dutyData } = await sb.from('duty_room').select('*');
    if (dutyData) allRecords.push(...dutyData.map(r => ({ ...r, source: 'Duty room' })));

    if (allRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Нет записей<\/td><\/tr>';
        return;
    }

    tbody.innerHTML = allRecords.map(record => `
        <tr>
            <td><strong>${record.id}</strong><br><small>[${record.source}]</small></td>
            <td>
                ${record.link ? `🔗 <a href="${record.link}" target="_blank">Ссылка</a><br>` : ''}
                ${record.period ? `📅 ${record.period}<br>🔢 Количество: ${record.quantity || '—'}<br>` : ''}
                ${record.comment ? `💬 ${record.comment}` : ''}
            </td>
            <td><button class="delete-btn" onclick="alert('Удаление из общего списка доступно в конкретной таблице')">❌ Удалить</button></td>
        </tr>
    `).join('');
}

function applyFilter() {
    currentFilter = document.getElementById('filterPeriod')?.value.trim().toLowerCase() || '';
    loadRecords();
}

function clearFilter() {
    currentFilter = '';
    if (document.getElementById('filterPeriod')) document.getElementById('filterPeriod').value = '';
    loadRecords();
}

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем первый блок меры
    if (document.getElementById('measuresContainer')) {
        addMeasureBlock();
    }

    // Обработчик добавления меры
    document.getElementById('addMeasureBlockBtn')?.addEventListener('click', () => {
        addMeasureBlock();
    });

    // Обработчик добавления консультации
    document.getElementById('addConsultationBtn')?.addEventListener('click', async () => {
        const link = document.getElementById('consultationLink').value.trim();
        const comment = document.getElementById('consultationComment').value.trim();
        if (!link) { showMessage('❌ Введите ссылку', 'error'); return; }
        await addConsultation(link, comment);
        document.getElementById('consultationLink').value = '';
        document.getElementById('consultationComment').value = '';
    });

    // Обработчик добавления в дежурку
    document.getElementById('addDutyBtn')?.addEventListener('click', async () => {
        const periodFrom = document.getElementById('dutyPeriodFrom').value;
        const periodTo = document.getElementById('dutyPeriodTo').value;
        const quantity = document.getElementById('dutyQuantity').value;
        const measuresArray = collectMeasures();

        if (!periodFrom || !periodTo) {
            showMessage('❌ Выберите начальную и конечную дату периода', 'error');
            return;
        }

        if (!quantity) {
            showMessage('❌ Введите количество', 'error');
            return;
        }

        await addDutyRecord(periodFrom, periodTo, quantity, measuresArray);

        document.getElementById('dutyPeriodFrom').value = '';
        document.getElementById('dutyPeriodTo').value = '';
        document.getElementById('dutyQuantity').value = '';
        const container = document.getElementById('measuresContainer');
        if (container) {
            container.innerHTML = '';
            addMeasureBlock();
        }
    });

    // Переключение таблицы
    document.getElementById('switchTableBtn')?.addEventListener('click', () => {
        currentTable = document.getElementById('tableSelector').value;
        toggleFormByTable(currentTable);
        loadRecords();
    });

    // Обновление
    document.getElementById('refreshBtn')?.addEventListener('click', () => loadRecords());

    // Общий список
    document.getElementById('combinedReportBtn')?.addEventListener('click', () => loadCombinedReport());

    // Фильтры
    document.getElementById('applyFilterBtn')?.addEventListener('click', () => applyFilter());
    document.getElementById('clearFilterBtn')?.addEventListener('click', () => clearFilter());

    // Загружаем данные
    toggleFormByTable(currentTable);
    loadRecords();
});