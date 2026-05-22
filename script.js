// script.js
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecords = [];
let filteredRecords = [];
let isLoading = false;
let refreshCounter = 0;

let currentFilters = {
    dateFrom: '',
    dateTo: '',
    table: 'all',
    text: ''
};

let selectedIds = new Set();

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

function showSpinner(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(2);
    return `${day}.${month}.${year}`;
}

// ========== РАБОТА С МЕРАМИ ==========
function addMeasureByType(type, containerId = 'measuresContainer') {
    const container = document.getElementById(containerId);
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
        default: return;
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

function collectMeasures(containerId = 'measuresContainer') {
    const measures = [];
    document.querySelectorAll(`#${containerId} .measure-card`).forEach(card => {
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

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
function switchTab(tableName) {
    const consultationForm = document.getElementById('consultationForm');
    const dutyForm = document.getElementById('dutyRoomForm');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.table === tableName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (tableName === 'Consultation_scenario') {
        consultationForm.style.display = 'block';
        dutyForm.style.display = 'none';
    } else {
        consultationForm.style.display = 'none';
        dutyForm.style.display = 'block';
    }
}

// ========== ЗАГРУЗКА ДАННЫХ (без кэша, без зацикливаний) ==========
// ========== ЗАГРУЗКА ДАННЫХ (С ПОВТОРНЫМИ ПОПЫТКАМИ) ==========
async function loadAllData(retryCount = 0) {
    if (isLoading) {
        console.log('Загрузка уже идёт, пропускаем');
        return;
    }

    isLoading = true;
    showSpinner(true);

    try {
        refreshCounter++;
        console.log(`🔄 Загрузка #${refreshCounter}, попытка ${retryCount + 1}`);

        // Таймаут для запроса (30 секунд)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 30000)
        );

        const fetchPromise = Promise.all([
            sb.from('Consultation_scenario').select('*').limit(500),
            sb.from('duty_room').select('*').limit(500)
        ]);

        const [consResponse, dutyResponse] = await Promise.race([fetchPromise, timeoutPromise]);

        const newRecords = [];

        if (consResponse.data && consResponse.data.length > 0) {
            newRecords.push(...consResponse.data.map(r => ({
                id: r.id,
                source: 'consultation',
                sourceName: 'Сценарии консультаций',
                displayDate: r.created_at?.split('T')[0] || '',
                created_at: r.created_at || new Date(0).toISOString(),
                link: r.link || '',
                comment: r.comment || ''
            })));
        }

        if (dutyResponse.data && dutyResponse.data.length > 0) {
            newRecords.push(...dutyResponse.data.map(r => ({
                id: r.id,
                source: 'duty',
                sourceName: 'Дежурка',
                displayDate: r.period_from || '',
                created_at: r.created_at || new Date(0).toISOString(),
                period_from: r.period_from || '',
                period_to: r.period_to || '',
                period: r.period || '',
                quantity: r.quantity || 0,
                measures: r.measures || []
            })));
        }

        // Сортируем
        newRecords.sort((a, b) => {
            const dateA = a.created_at || '';
            const dateB = b.created_at || '';
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB.localeCompare(dateA);
        });

        allRecords = newRecords;
        console.log(`📊 Загружено записей: ${allRecords.length}`);

        applyFilters();
        showMessage(`✅ Загружено ${allRecords.length} записей`, 'success');

    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);

        // Повторяем до 3 раз при ошибке соединения
        if (retryCount < 3 && (error.message === 'Timeout' || error.message?.includes('ERR_CONNECTION_RESET'))) {
            console.log(`🔄 Повторная попытка через ${(retryCount + 1) * 2} секунды...`);
            showMessage(`Ошибка соединения, повторная попытка ${retryCount + 1}/3...`, 'error');
            await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
            await loadAllData(retryCount + 1);
            return;
        }

        const tbody = document.getElementById('tableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">
                ⚠️ Ошибка подключения к базе данных.<br>
                Проверьте интернет или нажмите "🔄 Обновить"<br>
                <small>${error.message || 'Неизвестная ошибка'}</small>
            <\/td><\/tr>`;
        }
        showMessage('❌ Ошибка загрузки данных. Нажмите "Обновить"', 'error');
    } finally {
        showSpinner(false);
        isLoading = false;
    }
}

// ========== ФИЛЬТРАЦИЯ ==========
function applyFilters() {
    let filtered = [...allRecords];

    if (currentFilters.table !== 'all') {
        filtered = filtered.filter(r => r.source === currentFilters.table);
    }

    if (currentFilters.dateFrom) {
        filtered = filtered.filter(r => r.displayDate >= currentFilters.dateFrom);
    }

    if (currentFilters.dateTo) {
        filtered = filtered.filter(r => r.displayDate <= currentFilters.dateTo);
    }

    if (currentFilters.text) {
        const searchText = currentFilters.text.toLowerCase();
        filtered = filtered.filter(r => {
            if (r.source === 'consultation') {
                return (r.link?.toLowerCase().includes(searchText) ||
                       r.comment?.toLowerCase().includes(searchText));
            } else {
                return (r.period?.toLowerCase().includes(searchText) ||
                       JSON.stringify(r.measures).toLowerCase().includes(searchText));
            }
        });
    }

    filteredRecords = filtered;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');

    if (!tbody) return;

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет записей<\/td><\/tr>';
        return;
    }

    tbody.innerHTML = filteredRecords.map((record, index) => {
        let dataHtml = '';
        let sourceClass = record.source === 'consultation' ? 'source-consultation' : 'source-duty';
        let sourceText = record.source === 'consultation' ? '📋 Консультация' : '🚪 Дежурка';
        const key = `${record.source}_${record.id}`;
        const isChecked = selectedIds.has(key);

        if (record.source === 'consultation') {
            const linkText = record.link && record.link.length > 80 ? record.link.substring(0, 80) + '...' : (record.link || '—');
            dataHtml = `
                🔗 <a href="${record.link || '#'}" target="_blank">${linkText}</a><br>
                💬 Комментарий: ${record.comment || '—'}
            `;
        } else {
            let measuresHtml = '';
            if (record.measures && record.measures.length > 0) {
                measuresHtml = '<ul style="margin: 5px 0 0 15px;">' +
                    record.measures.map(m => {
                        switch(m.type) {
                            case 'new_type': return `<li>🆕 Новый вид: ${m.value || '—'}</li>`;
                            case 'new_solution': return `<li>💡 Новое решение: ${m.value || '—'}</li>`;
                            case 'task': return `<li>🚀 <a href="${m.value}" target="_blank">Задача</a></li>`;
                            case 'error': return `<li>⚠️ <a href="${m.value}" target="_blank">Ошибка</a></li>`;
                            default: return '';
                        }
                    }).join('') +
                    '</ul>';
            }

            const periodText = record.period_from && record.period_to ? `${formatDate(record.period_from)} — ${formatDate(record.period_to)}` : (record.period || '—');
            dataHtml = `
                📅 Период: ${periodText}<br>
                🔢 Количество: ${record.quantity || 0}<br>
                📋 Меры: ${measuresHtml || '—'}
            `;
        }

        return `
            <tr>
                <td style="text-align: center;"><input type="checkbox" class="row-checkbox" data-source="${record.source}" data-id="${record.id}" ${isChecked ? 'checked' : ''}></td>
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

    // Привязываем события к чекбоксам
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.removeEventListener('change', handleCheckboxChange);
        cb.addEventListener('change', handleCheckboxChange);
    });

    updateSelectAllState();
}

function handleCheckboxChange(e) {
    const source = e.target.dataset.source;
    const id = parseInt(e.target.dataset.id);
    toggleSelect(source, id);
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox');
    if (!selectAll) return;

    if (selectAll.checked) {
        filteredRecords.forEach(r => selectedIds.add(`${r.source}_${r.id}`));
    } else {
        filteredRecords.forEach(r => selectedIds.delete(`${r.source}_${r.id}`));
    }
    renderTable();
}

function toggleSelect(source, id) {
    const key = `${source}_${id}`;
    if (selectedIds.has(key)) {
        selectedIds.delete(key);
    } else {
        selectedIds.add(key);
    }
    updateSelectAllState();
}

function updateSelectAllState() {
    const selectAll = document.getElementById('selectAllCheckbox');
    if (!selectAll) return;

    const allSelected = filteredRecords.length > 0 &&
        filteredRecords.every(r => selectedIds.has(`${r.source}_${r.id}`));
    const someSelected = filteredRecords.some(r => selectedIds.has(`${r.source}_${r.id}`));

    selectAll.checked = allSelected;
    selectAll.indeterminate = someSelected && !allSelected;
}

// ========== CRUD ==========
async function addConsultation(link, comment) {
    const { error } = await sb.from('Consultation_scenario').insert([{
        link: link,
        comment: comment || null,
        created_at: new Date().toISOString()
    }]);

    if (error) {
        showMessage(`❌ ${error.message}`, 'error');
        return false;
    }

    showMessage('✅ Консультация добавлена!', 'success');

    // Очищаем форму
    document.getElementById('consultationLink').value = '';
    document.getElementById('consultationComment').value = '';

    // Перезагружаем данные
    await loadAllData();
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
        showMessage(`❌ ${error.message}`, 'error');
        return false;
    }

    showMessage('✅ Запись в дежурку добавлена!', 'success');

    // Очищаем форму
    document.getElementById('dutyPeriodFrom').value = '';
    document.getElementById('dutyPeriodTo').value = '';
    document.getElementById('dutyQuantity').value = '';
    document.getElementById('measuresContainer').innerHTML = '';

    // Перезагружаем данные
    await loadAllData();
    return true;
}

window.deleteRecord = async function(id, source) {
    if (!confirm('Удалить запись?')) return;
    const tableName = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    const { error } = await sb.from(tableName).delete().eq('id', id);
    if (error) {
        showMessage(`❌ ${error.message}`, 'error');
    } else {
        selectedIds.delete(`${source}_${id}`);
        showMessage('✅ Удалено', 'success');
        await loadAllData();
    }
};

// ========== РЕДАКТИРОВАНИЕ ==========
window.editRecord = async function(id, source) {
    const tableName = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    const { data, error } = await sb.from(tableName).select('*').eq('id', id).single();
    if (error) { showMessage('Ошибка загрузки', 'error'); return; }

    const oldModal = document.querySelector('.modal');
    if (oldModal) oldModal.remove();

    if (source === 'duty') {
        const newValue = prompt('Редактировать запись (JSON):\n\nФормат: {"period_from":"2024-01-01","period_to":"2024-01-07","quantity":10,"measures":[]}', JSON.stringify({
            period_from: data.period_from,
            period_to: data.period_to,
            quantity: data.quantity,
            measures: data.measures
        }, null, 2));
        if (newValue) {
            try {
                const updates = JSON.parse(newValue);
                await sb.from('duty_room').update(updates).eq('id', id);
                showMessage('✅ Обновлено', 'success');
                await loadAllData();
            } catch(e) { showMessage('Ошибка формата JSON', 'error'); }
        }
    } else {
        const newLink = prompt('Введите новую ссылку:', data.link);
        if (newLink) {
            await sb.from('Consultation_scenario').update({ link: newLink }).eq('id', id);
            showMessage('✅ Обновлено', 'success');
            await loadAllData();
        }
    }
};

// ========== ЭКСПОРТ ==========
function exportSelected() {
    const selectedRecords = filteredRecords.filter(r => selectedIds.has(`${r.source}_${r.id}`));
    if (selectedRecords.length === 0) {
        showMessage('Не выбрано ни одной записи', 'error');
        return;
    }

    const consultationRecords = selectedRecords.filter(r => r.source === 'consultation');
    const dutyRecords = selectedRecords.filter(r => r.source === 'duty');

    const wb = XLSX.utils.book_new();

    // Простой экспорт выбранных записей
    const simpleData = [
        ['Источник', 'Дата/Период', 'Количество', 'Ссылка', 'Комментарий', 'Меры']
    ];

    selectedRecords.forEach(record => {
        if (record.source === 'consultation') {
            simpleData.push([
                'Консультация',
                formatDate(record.displayDate),
                '',
                record.link || '',
                record.comment || '',
                ''
            ]);
        } else {
            let measuresText = '';
            if (record.measures && record.measures.length > 0) {
                measuresText = record.measures.map(m => `${m.type === 'new_type' ? 'Новый вид' : m.type === 'new_solution' ? 'Новое решение' : m.type === 'task' ? 'Задача' : 'Ошибка'}: ${m.value}`).join('; ');
            }
            simpleData.push([
                'Дежурка',
                record.period_from && record.period_to ? `${formatDate(record.period_from)} — ${formatDate(record.period_to)}` : record.period,
                record.quantity || 0,
                '',
                '',
                measuresText
            ]);
        }
    });

    const ws = XLSX.utils.aoa_to_sheet(simpleData);
    ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 40 }, { wch: 30 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Выбранные записи');

    const date = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    XLSX.writeFile(wb, `selected_records_${date}.xlsx`);
    showMessage(`✅ Экспортировано ${selectedRecords.length} записей`, 'success');
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('🟢 Страница загружена, инициализация...');

    // Вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.table));
    });

    // Кнопка обновления
    document.getElementById('manualRefreshBtn')?.addEventListener('click', async () => {
        showMessage('🔄 Обновление...', 'success');
        await loadAllData();
        showMessage('✅ Данные обновлены', 'success');
    });

    // Экспорт
    document.getElementById('exportSelectedBtn')?.addEventListener('click', exportSelected);
    document.getElementById('selectAllCheckbox')?.addEventListener('change', toggleSelectAll);

    // Фильтры
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

    if (filterDateFrom) filterDateFrom.addEventListener('change', updateFilters);
    if (filterDateTo) filterDateTo.addEventListener('change', updateFilters);
    if (filterTable) filterTable.addEventListener('change', updateFilters);
    if (filterText) filterText.addEventListener('input', updateFilters);

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (filterDateFrom) filterDateFrom.value = '';
            if (filterDateTo) filterDateTo.value = '';
            if (filterTable) filterTable.value = 'all';
            if (filterText) filterText.value = '';
            updateFilters();
        });
    }

    // Кнопки мер
    document.getElementById('addNewTypeBtn')?.addEventListener('click', () => addMeasureByType('new-type', 'measuresContainer'));
    document.getElementById('addNewSolutionBtn')?.addEventListener('click', () => addMeasureByType('new-solution', 'measuresContainer'));
    document.getElementById('addTaskBtn')?.addEventListener('click', () => addMeasureByType('task', 'measuresContainer'));
    document.getElementById('addErrorBtn')?.addEventListener('click', () => addMeasureByType('error', 'measuresContainer'));

    // Добавление консультации
    document.getElementById('addConsultationBtn')?.addEventListener('click', async () => {
        const link = document.getElementById('consultationLink').value.trim();
        const comment = document.getElementById('consultationComment').value.trim();
        if (!link) { showMessage('❌ Введите ссылку', 'error'); return; }
        await addConsultation(link, comment);
    });

    // Добавление в дежурку
    document.getElementById('addDutyBtn')?.addEventListener('click', async () => {
        const periodFrom = document.getElementById('dutyPeriodFrom').value;
        const periodTo = document.getElementById('dutyPeriodTo').value;
        const quantity = document.getElementById('dutyQuantity').value;
        const measures = collectMeasures('measuresContainer');

        if (!periodFrom || !periodTo) { showMessage('❌ Выберите период', 'error'); return; }
        if (!quantity) { showMessage('❌ Введите количество', 'error'); return; }

        await addDutyRecord(periodFrom, periodTo, quantity, measures);
    });

    // Загружаем данные
    loadAllData();
});