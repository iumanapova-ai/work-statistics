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

function addMeasureRow(measureData = null) {
    const container = document.getElementById('measuresContainer');
    if (!container) return;

    const rowDiv = document.createElement('div');
    rowDiv.className = 'measure-row';
    rowDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;';

    rowDiv.innerHTML = `
        <select class="measure-select" style="flex: 1; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
            <option value="">— Выберите меру —</option>
            <option value="Предупреждение">Предупреждение</option>
            <option value="Выговор">Выговор</option>
            <option value="Лишение премии">Лишение премии</option>
            <option value="Увольнение">Увольнение</option>
            <option value="Благодарность">Благодарность</option>
            <option value="Премия">Премия</option>
        </select>
        <input type="text" placeholder="Новый вид" class="measure-type" style="flex: 1; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
        <input type="url" placeholder="Ссылка на ошибку" class="measure-error" style="flex: 2; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
        <button type="button" class="remove-measure-btn" style="background: #dc3545; color: white; padding: 8px 12px; border: none; border-radius: 8px; cursor: pointer;" onclick="this.parentElement.remove()">✖️</button>
    `;

    const addButton = container.querySelector('.add-measure-btn');
    if (addButton && addButton.parentElement) {
        container.insertBefore(rowDiv, addButton.parentElement);
    } else {
        container.appendChild(rowDiv);
    }
}

function collectMeasures() {
    const measures = [];
    document.querySelectorAll('#measuresContainer .measure-row').forEach(row => {
        if (row.querySelector('.add-measure-btn')) return;
        const measure = row.querySelector('.measure-select')?.value;
        const new_type = row.querySelector('.measure-type')?.value;
        const error_link = row.querySelector('.measure-error')?.value;
        if (measure) {
            measures.push({ measure, new_type, error_link });
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
            try {
                const measures = typeof record.measures === 'string' ? JSON.parse(record.measures) : record.measures;
                if (measures && measures.length > 0) {
                    measuresHtml = '<ul style="margin: 5px 0 0 15px;">' +
                        measures.map(m => `<li><strong>${m.measure || '—'}</strong>${m.new_type ? ` → ${m.new_type}` : ''}${m.error_link ? ` → <a href="${m.error_link}" target="_blank">ошибка</a>` : ''}</li>`).join('') +
                        '</ul>';
                }
            } catch(e) { measuresHtml = '<i>ошибка данных</i>'; }

            return `
                <tr>
                    <td><strong>${record.id}</strong></td>
                    <td>
                        📅 <strong>Период:</strong> ${record.period}<br>
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

async function addDutyRecord(period, quantity, measuresArray) {
    const { error } = await sb.from('duty_room').insert([{
        period: period,
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
        let measuresStr = '';
        try {
            const measures = typeof data.measures === 'string' ? JSON.parse(data.measures) : data.measures;
            if (measures && measures.length) {
                measuresStr = JSON.stringify(measures);
            }
        } catch(e) {}

        modal.innerHTML = `
            <div class="modal-content">
                <h3>Редактировать запись #${id}</h3>
                <input type="text" id="editPeriod" value="${data.period || ''}" placeholder="Период">
                <input type="number" id="editQuantity" value="${data.quantity || ''}" placeholder="Количество">
                <input type="text" id="editMeasures" value='${measuresStr}' placeholder="Меры (JSON)">
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
                period: document.getElementById('editPeriod').value,
                quantity: parseInt(document.getElementById('editQuantity').value),
                measures: measuresVal
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
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Формирование общего списка...<\/td><\/tr>';
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
    if (document.getElementById('measuresContainer')) {
        addMeasureRow();
    }

    const addConsultationBtn = document.getElementById('addConsultationBtn');
    if (addConsultationBtn) {
        addConsultationBtn.addEventListener('click', async () => {
            const link = document.getElementById('consultationLink').value.trim();
            const comment = document.getElementById('consultationComment').value.trim();
            if (!link) { showMessage('❌ Введите ссылку', 'error'); return; }
            await addConsultation(link, comment);
            document.getElementById('consultationLink').value = '';
            document.getElementById('consultationComment').value = '';
        });
    }

    const addDutyBtn = document.getElementById('addDutyBtn');
    if (addDutyBtn) {
        addDutyBtn.addEventListener('click', async () => {
            const period = document.getElementById('dutyPeriod').value.trim();
            const quantity = document.getElementById('dutyQuantity').value;
            const measuresArray = collectMeasures();

            if (!period || !quantity) {
                showMessage('❌ Заполните период и количество', 'error');
                return;
            }

            await addDutyRecord(period, quantity, measuresArray);

            document.getElementById('dutyPeriod').value = '';
            document.getElementById('dutyQuantity').value = '';
            const container = document.getElementById('measuresContainer');
            if (container) {
                container.innerHTML = '<div class="measure-row"><button type="button" class="add-measure-btn" onclick="addMeasureRow()">+ Добавить меру</button></div>';
                addMeasureRow();
            }
        });
    }

    const switchTableBtn = document.getElementById('switchTableBtn');
    if (switchTableBtn) {
        switchTableBtn.addEventListener('click', () => {
            currentTable = document.getElementById('tableSelector').value;
            toggleFormByTable(currentTable);
            loadRecords();
        });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadRecords());
    }

    const combinedReportBtn = document.getElementById('combinedReportBtn');
    if (combinedReportBtn) {
        combinedReportBtn.addEventListener('click', () => loadCombinedReport());
    }

    const applyFilterBtn = document.getElementById('applyFilterBtn');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => applyFilter());
    }

    const clearFilterBtn = document.getElementById('clearFilterBtn');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', () => clearFilter());
    }

    toggleFormByTable(currentTable);
    loadRecords();
});