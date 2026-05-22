// script.js
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecords = [];
let filteredRecords = [];
let isLoading = false;
let cachedData = null;
let lastLoadTime = 0;
const CACHE_TTL = 60000;

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

// ========== ЗАГРУЗКА ДАННЫХ ==========
async function loadAllData(forceRefresh = false) {
    if (isLoading) return;

    const now = Date.now();

    if (!forceRefresh && cachedData && (now - lastLoadTime) < CACHE_TTL) {
        console.log('📦 Использую кэш');
        allRecords = cachedData;
        applyFilters();
        return;
    }

    isLoading = true;
    showSpinner(true);

    try {
        const startTime = performance.now();

        const [consResponse, dutyResponse] = await Promise.all([
            sb.from('Consultation_scenario').select('*'),
            sb.from('duty_room').select('*')
        ]);

        const endTime = performance.now();
        console.log(`⚡ Загрузка заняла ${(endTime - startTime).toFixed(0)} мс`);

        allRecords = [];

        if (consResponse.data && consResponse.data.length > 0) {
            allRecords.push(...consResponse.data.map(r => ({
                id: r.id,
                source: 'consultation',
                sourceName: 'Сценарии консультаций',
                displayDate: r.created_at?.split('T')[0] || '',
                link: r.link,
                comment: r.comment,
                created_at: r.created_at
            })));
            console.log(`📋 Загружено консультаций: ${consResponse.data.length}`);
        }

        if (dutyResponse.data && dutyResponse.data.length > 0) {
            allRecords.push(...dutyResponse.data.map(r => ({
                id: r.id,
                source: 'duty',
                sourceName: 'Дежурка',
                displayDate: r.period_from || '',
                period_from: r.period_from,
                period_to: r.period_to,
                period: r.period,
                quantity: r.quantity,
                measures: r.measures || [],
                created_at: r.created_at
            })));
            console.log(`🚪 Загружено дежурок: ${dutyResponse.data.length}`);
        }

        console.log(`📊 Всего записей: ${allRecords.length}`);

        cachedData = allRecords;
        lastLoadTime = now;

        applyFilters();

    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        const tbody = document.getElementById('tableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="color: red;">Ошибка загрузки: ${error.message}<\/td><\/tr>`;
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

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox');
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

function renderTable() {
    const tbody = document.getElementById('tableBody');

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет записей<\/td><\/tr>';
        return;
    }

    filteredRecords.sort((a, b) => (b.displayDate || '').localeCompare(a.displayDate || ''));

    tbody.innerHTML = filteredRecords.map((record, index) => {
        let dataHtml = '';
        let sourceClass = record.source === 'consultation' ? 'source-consultation' : 'source-duty';
        let sourceText = record.source === 'consultation' ? '📋 Консультация' : '🚪 Дежурка';
        const key = `${record.source}_${record.id}`;
        const isChecked = selectedIds.has(key);

        if (record.source === 'consultation') {
            dataHtml = `
                🔗 <a href="${record.link}" target="_blank">${record.link.length > 80 ? record.link.substring(0, 80) + '...' : record.link}</a><br>
                💬 Комментарий: ${record.comment || '—'}
            `;
        } else {
            let measuresHtml = '';
            if (record.measures && record.measures.length > 0) {
                measuresHtml = '<ul style="margin: 5px 0 0 15px;">' +
                    record.measures.map(m => {
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
                📅 Период: ${record.period_from && record.period_to ? `${formatDate(record.period_from)} — ${formatDate(record.period_to)}` : record.period}<br>
                🔢 Количество: ${record.quantity}<br>
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

    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const source = cb.dataset.source;
            const id = parseInt(cb.dataset.id);
            toggleSelect(source, id);
        });
    });

    updateSelectAllState();
}

// ========== ФОРМАТИРОВАНИЕ ДАТЫ ==========
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(2);
    return `${day}.${month}.${year}`;
}

// ========== ЭКСПОРТ В EXCEL ==========
function exportToExcel(records, filename = 'export.xlsx') {
    if (!records || records.length === 0) {
        showMessage('Нет данных для экспорта', 'error');
        return;
    }

    // Разделяем записи по источникам
    const consultationRecords = records.filter(r => r.source === 'consultation');
    const dutyRecords = records.filter(r => r.source === 'duty');

    const wb = XLSX.utils.book_new();

    // ========== СВОДНЫЙ ОТЧЕТ (ПЕРВЫЙ ЛИСТ) ==========
    if (dutyRecords.length > 0 && consultationRecords.length > 0) {
        const summaryData = [];

        // ДЕЖУРКА
        summaryData.push(['ДЕЖУРКА']);
        summaryData.push(['Период', 'Количество', 'Новых видов', 'Новых решений', 'Задач', 'Ошибок']);

        let totalDutyQuantity = 0;
        let totalDutyNewTypes = 0;
        let totalDutyNewSolutions = 0;
        let totalDutyTasks = 0;
        let totalDutyErrors = 0;

        dutyRecords.forEach(record => {
            const measures = record.measures || [];
            const qty = record.quantity || 0;
            const newTypes = measures.filter(m => m.type === 'new_type').length;
            const newSolutions = measures.filter(m => m.type === 'new_solution').length;
            const tasks = measures.filter(m => m.type === 'task').length;
            const errors = measures.filter(m => m.type === 'error').length;

            totalDutyQuantity += qty;
            totalDutyNewTypes += newTypes;
            totalDutyNewSolutions += newSolutions;
            totalDutyTasks += tasks;
            totalDutyErrors += errors;

            summaryData.push([
                `${formatDate(record.period_from)} — ${formatDate(record.period_to)}`,
                qty,
                newTypes,
                newSolutions,
                tasks,
                errors
            ]);
        });

        summaryData.push(['ИТОГО ПО ДЕЖУРКЕ:', totalDutyQuantity, totalDutyNewTypes, totalDutyNewSolutions, totalDutyTasks, totalDutyErrors]);
        summaryData.push([]);

        // СЦЕНАРИИ КОНСУЛЬТАЦИЙ
        summaryData.push(['СЦЕНАРИИ КОНСУЛЬТАЦИЙ']);
        summaryData.push(['Дата', 'Ссылка', 'Комментарий']);

        consultationRecords.forEach(record => {
            summaryData.push([formatDate(record.displayDate), record.link, record.comment || '']);
        });

        // Добавляем общее количество записей
        summaryData.push([]);
        summaryData.push([`ВСЕГО ЗАПИСЕЙ: ${consultationRecords.length}`]);

        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 40 }];

        // Границы и жирный шрифт
        applyBordersAndBold(ws);

        XLSX.utils.book_append_sheet(wb, ws, '📊 Сводный отчет');
    }

    // ========== ЛИСТ С ДЕЖУРКОЙ ==========
    if (dutyRecords.length > 0) {
        let totalQuantity = 0;
        let totalNewTypes = 0;
        let totalNewSolutions = 0;
        let totalTasks = 0;
        let totalErrors = 0;

        const dutyRows = [];
        dutyRecords.forEach((record, idx) => {
            totalQuantity += record.quantity || 0;

            const measures = record.measures || [];
            const newTypes = measures.filter(m => m.type === 'new_type').map(m => m.value);
            const newSolutions = measures.filter(m => m.type === 'new_solution').map(m => m.value);
            const tasks = measures.filter(m => m.type === 'task').map(m => m.value);
            const errors = measures.filter(m => m.type === 'error').map(m => m.value);

            totalNewTypes += newTypes.length;
            totalNewSolutions += newSolutions.length;
            totalTasks += tasks.length;
            totalErrors += errors.length;

            dutyRows.push({
                period: `${formatDate(record.period_from)} — ${formatDate(record.period_to)}`,
                quantity: record.quantity || 0,
                newTypes,
                newSolutions,
                tasks,
                errors
            });
        });

        const excelData = [];

        // Шапка основной таблицы
        excelData.push(['Период', 'Количество обращений']);

        // Данные по периодам
        dutyRows.forEach(row => {
            excelData.push([row.period, row.quantity]);
        });

        // Итоговая строка
        excelData.push(['ИТОГО:', totalQuantity]);
        excelData.push([]);
        excelData.push(['Меры']);
        excelData.push(['Новый вид', 'Новое решение', 'Задача в разработку', 'Ошибка']);

        // Данные по мерам - без пустых ячеек, подряд
        dutyRows.forEach(row => {
            const allMeasures = [];
            const maxRows = Math.max(row.newTypes.length, row.newSolutions.length, row.tasks.length, row.errors.length);

            for (let i = 0; i < maxRows; i++) {
                allMeasures.push([
                    row.newTypes[i] || '',
                    row.newSolutions[i] || '',
                    row.tasks[i] || '',
                    row.errors[i] || ''
                ]);
            }
            // Добавляем все меры подряд без разделителей
            allMeasures.forEach(measureRow => {
                excelData.push(measureRow);
            });
        });

        // Итоги по мерам
        excelData.push(['ИТОГО ПО МЕРАМ:', totalNewTypes, totalNewSolutions, totalTasks, totalErrors]);

        const ws = XLSX.utils.aoa_to_sheet(excelData);
        ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 40 }, { wch: 40 }];

        applyBordersAndBold(ws);

        XLSX.utils.book_append_sheet(wb, ws, '🚪 Дежурка');
    }

    // ========== ЛИСТ С КОНСУЛЬТАЦИЯМИ ==========
    if (consultationRecords.length > 0) {
        const consultationData = [
            ['Дата', 'Ссылка', 'Комментарий']
        ];

        consultationRecords.forEach((record, idx) => {
            consultationData.push([formatDate(record.displayDate), record.link, record.comment || '']);
        });

        // Добавляем общее количество записей
        consultationData.push([]);
        consultationData.push([`ВСЕГО ЗАПИСЕЙ: ${consultationRecords.length}`]);

        const ws = XLSX.utils.aoa_to_sheet(consultationData);
        ws['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 40 }];

        applyBordersAndBold(ws);

        XLSX.utils.book_append_sheet(wb, ws, '📋 Консультации');
    }

    XLSX.writeFile(wb, filename);
    showMessage(`✅ Экспортировано ${records.length} записей`, 'success');
}

// Вспомогательная функция для применения границ и жирного шрифта
function applyBordersAndBold(ws) {
    if (!ws['!ref']) return;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const borderStyle = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
    };
    const boldStyle = { font: { bold: true }, border: borderStyle };
    const normalStyle = { border: borderStyle };

    // Определяем строки с заголовками (первые строки каждого блока)
    const headerRows = new Set();

    // Проходим по всем ячейкам и ищем заголовки
    for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellAddress]) {
                ws[cellAddress] = { t: 's', v: '' };
            }

            // Применяем границы ко всем ячейкам
            ws[cellAddress].s = normalStyle;

            // Проверяем, является ли ячейка заголовком
            const cellValue = ws[cellAddress].v;
            if (cellValue && typeof cellValue === 'string') {
                // Заголовки: Период, Количество обращений, ИТОГО, Меры, Новый вид, и т.д.
                if (cellValue === 'Период' || cellValue === 'Количество обращений' ||
                    cellValue === 'ИТОГО:' || cellValue === 'Меры' ||
                    cellValue === 'Новый вид' || cellValue === 'Новое решение' ||
                    cellValue === 'Задача в разработку' || cellValue === 'Ошибка' ||
                    cellValue === 'ИТОГО ПО МЕРАМ:' || cellValue === 'Дата' ||
                    cellValue === 'Ссылка' || cellValue === 'Комментарий' ||
                    cellValue === 'ДЕЖУРКА' || cellValue === 'СЦЕНАРИИ КОНСУЛЬТАЦИЙ' ||
                    cellValue.startsWith('ВСЕГО ЗАПИСЕЙ') || cellValue === 'ИТОГО ПО ДЕЖУРКЕ:') {
                    ws[cellAddress].s = boldStyle;
                    headerRows.add(R);
                }
            }
        }
    }

    // Дополнительно выделяем жирным первую строку каждого блока
    for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cellAddress] && ws[cellAddress].v === 'Меры') {
                // Заголовок "Меры" делаем жирным
                ws[cellAddress].s = boldStyle;
            }
        }
    }
}

function exportSelected() {
    const selectedRecords = filteredRecords.filter(r => selectedIds.has(`${r.source}_${r.id}`));
    if (selectedRecords.length === 0) {
        showMessage('Не выбрано ни одной записи', 'error');
        return;
    }
    const date = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    exportToExcel(selectedRecords, `selected_records_${date}.xlsx`);
}

// ========== CRUD ==========
async function addConsultation(link, comment) {
    const { error } = await sb.from('Consultation_scenario').insert([{ link, comment: comment || null, created_at: new Date().toISOString() }]);
    if (error) { showMessage(`❌ ${error.message}`, 'error'); return false; }
    showMessage('✅ Консультация добавлена!', 'success');
    loadAllData(true);
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

    if (error) { showMessage(`❌ ${error.message}`, 'error'); return false; }
    showMessage('✅ Запись в дежурку добавлена!', 'success');
    loadAllData(true);
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
        loadAllData(true);
    }
};

// ========== РЕДАКТИРОВАНИЕ ==========
function openEditDutyModal(id, data) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    let measuresHtml = '';
    if (data.measures && data.measures.length > 0) {
        measuresHtml = data.measures.map((m, idx) => {
            let typeClass = '';
            let title = '';
            let value = m.value;
            switch(m.type) {
                case 'new_type': typeClass = 'new-type'; title = '🆕 Новый вид'; break;
                case 'new_solution': typeClass = 'new-solution'; title = '💡 Новое решение'; break;
                case 'task': typeClass = 'task'; title = '🚀 Задача'; break;
                case 'error': typeClass = 'error'; title = '⚠️ Ошибка'; break;
            }
            return `
                <div class="measure-card measure-${typeClass}" data-idx="${idx}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong>${title}</strong>
                        <button type="button" class="remove-measure-btn" onclick="this.closest('.measure-card').remove()">✖️</button>
                    </div>
                    <input type="${m.type === 'task' || m.type === 'error' ? 'url' : 'text'}" class="measure-value" value="${value.replace(/"/g, '&quot;')}" placeholder="Введите значение" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
                </div>
            `;
        }).join('');
    }

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; width: 600px; max-width: 90%; max-height: 80vh; overflow-y: auto;">
            <h3 style="margin-bottom: 20px;">✏️ Редактировать запись #${id}</h3>

            <div class="form-group">
                <label>📅 Период (от)</label>
                <input type="date" id="editPeriodFrom" value="${data.period_from || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
            </div>

            <div class="form-group">
                <label>📅 Период (до)</label>
                <input type="date" id="editPeriodTo" value="${data.period_to || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
            </div>

            <div class="form-group">
                <label>🔢 Количество</label>
                <input type="number" id="editQuantity" value="${data.quantity || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
            </div>

            <div class="form-group">
                <label>📋 Меры</label>
                <div id="editMeasuresContainer">
                    ${measuresHtml || '<div style="color: #999; text-align: center; padding: 20px;">Нет мер. Добавьте ниже.</div>'}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-small" onclick="addEditMeasure('new-type')">➕ Новый вид</button>
                    <button type="button" class="btn btn-small" onclick="addEditMeasure('new-solution')">➕ Новое решение</button>
                    <button type="button" class="btn btn-small" onclick="addEditMeasure('task')">➕ Задача</button>
                    <button type="button" class="btn btn-small" onclick="addEditMeasure('error')">➕ Ошибка</button>
                </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 25px;">
                <button id="saveEditBtn" class="btn btn-primary">💾 Сохранить</button>
                <button id="cancelEditBtn" class="btn btn-secondary">❌ Отмена</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    window.addEditMeasure = (type) => {
        const container = document.getElementById('editMeasuresContainer');
        if (!container) return;

        if (container.innerHTML.includes('Нет мер')) {
            container.innerHTML = '';
        }

        const blockDiv = document.createElement('div');
        blockDiv.className = `measure-card measure-${type}`;

        let title = '', placeholder = '', inputType = 'text';
        switch(type) {
            case 'new-type': title = '🆕 Новый вид'; placeholder = 'Введите новый вид'; break;
            case 'new-solution': title = '💡 Новое решение'; placeholder = 'Введите новое решение'; break;
            case 'task': title = '🚀 Задача'; placeholder = 'Ссылка на задачу'; inputType = 'url'; break;
            case 'error': title = '⚠️ Ошибка'; placeholder = 'Ссылка на ошибку'; inputType = 'url'; break;
        }

        blockDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong>${title}</strong>
                <button type="button" class="remove-measure-btn" onclick="this.closest('.measure-card').remove()">✖️</button>
            </div>
            <input type="${inputType}" class="measure-value" placeholder="${placeholder}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
        `;
        container.appendChild(blockDiv);
    };

    document.getElementById('saveEditBtn').onclick = async () => {
        const measures = [];
        document.querySelectorAll('#editMeasuresContainer .measure-card').forEach(card => {
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

        const updates = {
            period_from: document.getElementById('editPeriodFrom').value,
            period_to: document.getElementById('editPeriodTo').value,
            quantity: parseInt(document.getElementById('editQuantity').value),
            measures: measures
        };
        updates.period = `${updates.period_from} — ${updates.period_to}`;

        const { error } = await sb.from('duty_room').update(updates).eq('id', id);
        if (error) {
            showMessage(`❌ ${error.message}`, 'error');
        } else {
            showMessage('✅ Запись обновлена', 'success');
        }
        modal.remove();
        loadAllData(true);
    };

    document.getElementById('cancelEditBtn').onclick = () => modal.remove();
}

function openEditConsultationModal(id, data) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; width: 500px; max-width: 90%;">
            <h3 style="margin-bottom: 20px;">✏️ Редактировать запись #${id}</h3>
            <div class="form-group">
                <label>🔗 Ссылка</label>
                <input type="url" id="editLink" value="${data.link || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
            </div>
            <div class="form-group">
                <label>💬 Комментарий</label>
                <textarea id="editComment" rows="3" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">${data.comment || ''}</textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="saveEditBtn" class="btn btn-primary">💾 Сохранить</button>
                <button id="cancelEditBtn" class="btn btn-secondary">❌ Отмена</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('saveEditBtn').onclick = async () => {
        const updates = {
            link: document.getElementById('editLink').value,
            comment: document.getElementById('editComment').value || null
        };
        const { error } = await sb.from('Consultation_scenario').update(updates).eq('id', id);
        if (error) {
            showMessage(`❌ ${error.message}`, 'error');
        } else {
            showMessage('✅ Запись обновлена', 'success');
        }
        modal.remove();
        loadAllData(true);
    };

    document.getElementById('cancelEditBtn').onclick = () => modal.remove();
}

window.editRecord = async function(id, source) {
    const tableName = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    const { data, error } = await sb.from(tableName).select('*').eq('id', id).single();
    if (error) { showMessage('Ошибка загрузки', 'error'); return; }

    const oldModal = document.querySelector('.modal');
    if (oldModal) oldModal.remove();

    if (source === 'duty') {
        openEditDutyModal(id, data);
    } else {
        openEditConsultationModal(id, data);
    }
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    // Вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.table));
    });

    // Экспорт выбранных
    document.getElementById('exportSelectedBtn')?.addEventListener('click', exportSelected);

    // Выделить все
    document.getElementById('selectAllCheckbox')?.addEventListener('change', toggleSelectAll);

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

    // Кнопки добавления мер
    const addNewTypeBtn = document.getElementById('addNewTypeBtn');
    const addNewSolutionBtn = document.getElementById('addNewSolutionBtn');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const addErrorBtn = document.getElementById('addErrorBtn');

    if (addNewTypeBtn) addNewTypeBtn.addEventListener('click', () => addMeasureByType('new-type', 'measuresContainer'));
    if (addNewSolutionBtn) addNewSolutionBtn.addEventListener('click', () => addMeasureByType('new-solution', 'measuresContainer'));
    if (addTaskBtn) addTaskBtn.addEventListener('click', () => addMeasureByType('task', 'measuresContainer'));
    if (addErrorBtn) addErrorBtn.addEventListener('click', () => addMeasureByType('error', 'measuresContainer'));

    // Добавление консультации
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

    // Добавление в дежурку
    const addDutyBtn = document.getElementById('addDutyBtn');
    if (addDutyBtn) {
        addDutyBtn.addEventListener('click', async () => {
            const periodFrom = document.getElementById('dutyPeriodFrom').value;
            const periodTo = document.getElementById('dutyPeriodTo').value;
            const quantity = document.getElementById('dutyQuantity').value;
            const measures = collectMeasures('measuresContainer');

            if (!periodFrom || !periodTo) { showMessage('❌ Выберите период', 'error'); return; }
            if (!quantity) { showMessage('❌ Введите количество', 'error'); return; }

            await addDutyRecord(periodFrom, periodTo, quantity, measures);

            document.getElementById('dutyPeriodFrom').value = '';
            document.getElementById('dutyPeriodTo').value = '';
            document.getElementById('dutyQuantity').value = '';
            const container = document.getElementById('measuresContainer');
            if (container) container.innerHTML = '';
        });
    }

    // Загружаем данные
    loadAllData();
});