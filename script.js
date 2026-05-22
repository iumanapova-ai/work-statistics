// script.js
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecords = [];
let filteredRecords = [];
let currentActiveTable = 'Consultation_scenario';
let currentFilters = {
    dateFrom: '',
    dateTo: '',
    table: 'all',
    text: ''
};

// ========== РАБОТА С МЕРАМИ ==========

function addMeasureByType(type) {
    const container = document.getElementById('measuresContainer');
    if (!container) return;

    const blockDiv = document.createElement('div');
    blockDiv.className = `measure-card measure-${type}`;

    let title = '', placeholder = '', inputType = 'text';

    switch(type) {
        case 'new-type':
            title = '🆕 Новый вид';
            placeholder = 'Введите новый вид';
            break;
        case 'new-solution':
            title = '💡 Новое решение';
            placeholder = 'Введите новое решение';
            break;
        case 'task':
            title = '🚀 Задача в разработку';
            placeholder = 'Ссылка на задачу';
            inputType = 'url';
            break;
        case 'error':
            title = '⚠️ Ошибка';
            placeholder = 'Ссылка на ошибку';
            inputType = 'url';
            break;
    }

    blockDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>${title}</strong>
            <button type="button" class="remove-measure-btn" onclick="this.closest('.measure-card').remove()">✖️</button>
        </div>
        <input type="${inputType}" class="measure-value" placeholder="${placeholder}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
    `;

    container.appendChild(blockDiv);
}

function collectMeasures() {
    const measures = [];
    document.querySelectorAll('#measuresContainer .measure-card').forEach(card => {
        const value = card.querySelector('.measure-value')?.value;
        if (!value || value.trim() === '') return;

        if (card.classList.contains('measure-new-type')) {
            measures.push({ type: 'new_type', value: value.trim() });
        } else if (card.classList.contains('measure-new-solution')) {
            measures.push({ type: 'new_solution', value: value.trim() });
        } else if (card.classList.contains('measure-task')) {
            measures.push({ type: 'task', value: value.trim() });
        } else if (card.classList.contains('measure-error')) {
            measures.push({ type: 'error', value: value.trim() });
        }
    });
    return measures;
}

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

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========

function switchTab(tableName) {
    currentActiveTable = tableName;

    // Обновляем активную кнопку
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.table === tableName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Показываем нужную форму
    const consultationForm = document.getElementById('consultationForm');
    const dutyForm = document.getElementById('dutyRoomForm');

    if (tableName === 'Consultation_scenario') {
        consultationForm.style.display = 'block';
        dutyForm.style.display = 'none';
    } else {
        consultationForm.style.display = 'none';
        dutyForm.style.display = 'block';
    }
}

// ========== ЗАГРУЗКА ДАННЫХ ==========

async function loadAllData() {
    document.getElementById('tableBody').innerHTML = '<tr><td colspan="4">Загрузка...<\/td><\/tr>';

    try {
        const [consData, dutyData] = await Promise.all([
            sb.from('Consultation_scenario').select('*'),
            sb.from('duty_room').select('*')
        ]);

        allRecords = [];

        if (consData.data) {
            allRecords.push(...consData.data.map(r => ({
                id: r.id,
                source: 'consultation',
                sourceName: 'Сценарии консультаций',
                displayDate: r.created_at?.split('T')[0] || '',
                data: {
                    link: r.link,
                    comment: r.comment
                }
            })));
        }

        if (dutyData.data) {
            allRecords.push(...dutyData.data.map(r => ({
                id: r.id,
                source: 'duty',
                sourceName: 'Duty room',
                displayDate: r.period_from || r.created_at?.split('T')[0] || '',
                data: {
                    period_from: r.period_from,
                    period_to: r.period_to,
                    period: r.period,
                    quantity: r.quantity,
                    measures: r.measures
                }
            })));
        }

        applyFilters();
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="4" style="color: red;">Ошибка загрузки<\/td><\/tr>';
    }
}

// ========== ФИЛЬТРАЦИЯ ==========

function applyFilters() {
    let filtered = [...allRecords];

    // Фильтр по таблице
    if (currentFilters.table !== 'all') {
        filtered = filtered.filter(r => r.source === currentFilters.table);
    }

    // Фильтр по дате (ОТ)
    if (currentFilters.dateFrom) {
        filtered = filtered.filter(r => r.displayDate >= currentFilters.dateFrom);
    }

    // Фильтр по дате (ДО)
    if (currentFilters.dateTo) {
        filtered = filtered.filter(r => r.displayDate <= currentFilters.dateTo);
    }

    // Фильтр по тексту
    if (currentFilters.text) {
        const searchText = currentFilters.text.toLowerCase();
        filtered = filtered.filter(r => {
            if (r.source === 'consultation') {
                return r.data.link?.toLowerCase().includes(searchText) ||
                       r.data.comment?.toLowerCase().includes(searchText);
            } else {
                return r.data.period?.toLowerCase().includes(searchText) ||
                       JSON.stringify(r.data.measures).toLowerCase().includes(searchText);
            }
        });
    }

    filteredRecords = filtered;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Нет записей<\/td><\/tr>';
        return;
    }

    // Сортируем по дате (новые сверху)
    filteredRecords.sort((a, b) => (b.displayDate || '').localeCompare(a.displayDate || ''));

    tbody.innerHTML = filteredRecords.map((record, index) => {
        let dataHtml = '';
        let sourceClass = record.source === 'consultation' ? 'source-consultation' : 'source-duty';
        let sourceText = record.source === 'consultation' ? '📋 Консультация' : '🚪 Дежурка';

        if (record.source === 'consultation') {
            dataHtml = `
                🔗 <a href="${record.data.link}" target="_blank">${record.data.link}</a><br>
                💬 Комментарий: ${record.data.comment || '—'}
            `;
        } else {
            let measuresHtml = '';
            if (record.data.measures && record.data.measures.length > 0) {
                measuresHtml = '<ul style="margin: 5px 0 0 15px;">' +
                    record.data.measures.map(m => {
                        switch(m.type) {
                            case 'new_type': return `<li>🆕 Новый вид: ${m.value}</li>`;
                            case 'new_solution': return `<li>💡 Новое решение: ${m.value}</li>`;
                            case 'task': return `<li>🚀 <a href="${m.value}" target="_blank">Задача</a></li>`;
                            case 'error': return `<li>⚠️ <a href="${m.value}" target="_blank">Ошибка</a></li>`;
                            default: return '';
                        }
                    }).join('') +
                    '</ul>';
            }

            dataHtml = `
                📅 Период: ${record.data.period_from && record.data.period_to ? `${record.data.period_from} — ${record.data.period_to}` : record.data.period}<br>
                🔢 Количество: ${record.data.quantity}<br>
                📋 Меры: ${measuresHtml || '—'}
            `;
        }

        return `
            <tr>
                <td>${index + 1}</td>
                <td><span class="source-badge ${sourceClass}">${sourceText}</span></td>
                <td>${dataHtml}</td>
                <td>
                    <button class="edit-btn" onclick="editRecord(${record.id}, '${record.source}')">✏️</button>
                    <button class="delete-btn" onclick="deleteRecord(${record.id}, '${record.source}')">🗑️</button>
                 </td>
            </tr>
        `;
    }).join('');
}

// ========== CRUD ОПЕРАЦИИ ==========

async function addConsultation(link, comment) {
    const { error } = await sb.from('Consultation_scenario').insert([{ link, comment: comment || null }]);
    if (error) {
        showMessage(`❌ Ошибка: ${error.message}`, 'error');
        return false;
    }
    showMessage('✅ Консультация добавлена!', 'success');
    loadAllData();
    return true;
}

async function addDutyRecord(periodFrom, periodTo, quantity, measuresArray) {
    const periodText = `${periodFrom} — ${periodTo}`;
    const cleanMeasures = measuresArray.filter(m => m.value && m.value.trim() !== '');

    const { error } = await sb.from('duty_room').insert([{
        period_from: periodFrom,
        period_to: periodTo,
        period: periodText,
        quantity: parseInt(quantity),
        measures: cleanMeasures,
        created_at: new Date().toISOString()
    }]);

    if (error) {
        showMessage(`❌ Ошибка: ${error.message}`, 'error');
        return false;
    }
    showMessage('✅ Запись в дежурку добавлена!', 'success');
    loadAllData();
    return true;
}

window.deleteRecord = async function(id, source) {
    if (!confirm('Удалить запись?')) return;
    const tableName = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    const { error } = await sb.from(tableName).delete().eq('id', id);
    if (error) {
        showMessage(`❌ Ошибка: ${error.message}`, 'error');
    } else {
        showMessage('✅ Удалено', 'success');
        loadAllData();
    }
};

window.editRecord = async function(id, source) {
    const tableName = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    const { data, error } = await sb.from(tableName).select('*').eq('id', id).single();
    if (error) {
        showMessage('Ошибка загрузки', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1001;';

    if (source === 'duty') {
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; width: 500px; max-width: 90%;">
                <h3>Редактировать запись #${id}</h3>
                <input type="date" id="editPeriodFrom" value="${data.period_from || ''}" style="width: 100%; margin-bottom: 10px; padding: 8px;">
                <input type="date" id="editPeriodTo" value="${data.period_to || ''}" style="width: 100%; margin-bottom: 10px; padding: 8px;">
                <input type="number" id="editQuantity" value="${data.quantity || ''}" style="width: 100%; margin-bottom: 10px; padding: 8px;">
                <textarea id="editMeasures" rows="5" style="width: 100%; margin-bottom: 10px; padding: 8px;">${JSON.stringify(data.measures || [], null, 2)}</textarea>
                <div style="display: flex; gap: 10px;">
                    <button id="saveEditBtn" style="padding: 10px 20px;">💾 Сохранить</button>
                    <button id="cancelEditBtn" style="padding: 10px 20px;">❌ Отмена</button>
                </div>
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; width: 500px; max-width: 90%;">
                <h3>Редактировать запись #${id}</h3>
                <input type="url" id="editLink" value="${data.link || ''}" style="width: 100%; margin-bottom: 10px; padding: 8px;">
                <textarea id="editComment" rows="3" style="width: 100%; margin-bottom: 10px; padding: 8px;">${data.comment || ''}</textarea>
                <div style="display: flex; gap: 10px;">
                    <button id="saveEditBtn" style="padding: 10px 20px;">💾 Сохранить</button>
                    <button id="cancelEditBtn" style="padding: 10px 20px;">❌ Отмена</button>
                </div>
            </div>
        `;
    }

    document.body.appendChild(modal);

    document.getElementById('saveEditBtn').onclick = async () => {
        if (source === 'duty') {
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
        loadAllData();
    };

    document.getElementById('cancelEditBtn').onclick = () => modal.remove();
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========

document.addEventListener('DOMContentLoaded', () => {
    // Вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.table);
        });
    });

    // Фильтр иконка
    const filterIcon = document.getElementById('filterIcon');
    const filterPanel = document.getElementById('filterPanel');
    filterIcon?.addEventListener('click', () => {
        filterPanel.style.display = filterPanel.style.display === 'none' ? 'block' : 'none';
    });

    // Элементы фильтров
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    const filterTable = document.getElementById('filterTable');
    const filterText = document.getElementById('filterText');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    function updateFilters() {
        currentFilters = {
            dateFrom: filterDateFrom?.value || '',
            dateTo: filterDateTo?.value || '',
            table: filterTable?.value || 'all',
            text: filterText?.value || ''
        };
        applyFilters();
    }

    filterDateFrom?.addEventListener('change', updateFilters);
    filterDateTo?.addEventListener('change', updateFilters);
    filterTable?.addEventListener('change', updateFilters);
    filterText?.addEventListener('input', updateFilters);

    clearFiltersBtn?.addEventListener('click', () => {
        if (filterDateFrom) filterDateFrom.value = '';
        if (filterDateTo) filterDateTo.value = '';
        if (filterTable) filterTable.value = 'all';
        if (filterText) filterText.value = '';
        updateFilters();
    });

    // Кнопки добавления мер
    document.getElementById('addNewTypeBtn')?.addEventListener('click', () => addMeasureByType('new-type'));
    document.getElementById('addNewSolutionBtn')?.addEventListener('click', () => addMeasureByType('new-solution'));
    document.getElementById('addTaskBtn')?.addEventListener('click', () => addMeasureByType('task'));
    document.getElementById('addErrorBtn')?.addEventListener('click', () => addMeasureByType('error'));

    // Добавление консультации
    document.getElementById('addConsultationBtn')?.addEventListener('click', async () => {
        const link = document.getElementById('consultationLink').value.trim();
        const comment = document.getElementById('consultationComment').value.trim();
        if (!link) { showMessage('❌ Введите ссылку', 'error'); return; }
        await addConsultation(link, comment);
        document.getElementById('consultationLink').value = '';
        document.getElementById('consultationComment').value = '';
    });

    // Добавление в дежурку
    document.getElementById('addDutyBtn')?.addEventListener('click', async () => {
        const periodFrom = document.getElementById('dutyPeriodFrom').value;
        const periodTo = document.getElementById('dutyPeriodTo').value;
        const quantity = document.getElementById('dutyQuantity').value;
        const measuresArray = collectMeasures();

        if (!periodFrom || !periodTo) {
            showMessage('❌ Выберите период', 'error');
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
        if (container) container.innerHTML = '';
    });

    // Загружаем данные
    switchTab('Consultation_scenario');
    loadAllData();
});